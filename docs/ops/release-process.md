# Release Process

This document is the canonical step-by-step guide for cutting an RC, running
gates, building evidence, and promoting to production.

**Reference this doc** before starting any release. The process has non-obvious
sequencing constraints imposed by the `Release and RC smoke gate` repository
ruleset.

**Evidence inheritance:** Some gates may be inherited from prior releases
when the tested code path has not changed. See
`docs/release/evidence-inheritance-policy.md` for the full policy, gate
categories, age limits, and the current inheritance record.

---

## Overview

Every production release follows five stages:

1. **Prepare main** — code merged, version bumped, CHANGELOG complete
2. **RC branch + smoke gate** — create `rc/vX.Y.Z`, trigger and pass smoke
3. **RC evidence + RC tag** — collect run IDs, write manifest, tag `vX.Y.Z-rc.N`
4. **Production evidence + production tag** — confirm remaining gates, tag `vX.Y.Z`, publish release
5. **Update public-facing pages** — README, CHANGELOG, GitHub release notes, About

---

## Prerequisites

Before starting:

- All SLICE work merged to `main`. CI green on `main`.
- `package.json` and workspace package versions bumped to the release version.
- `CHANGELOG.md` entry for the version complete (including `Known limitations`
  if any).
- The self-hosted runner at `enlogy@10.0.0.32` is reachable and the
  `[self-hosted, freeswitch]` GitHub Actions runner service is active.

---

## Stage 1 — Prepare main

Nothing automated here; it is done as part of normal feature work. Verify:

```sh
# All checks green on main
gh run list --workflow=ci.yml --limit=1 --json conclusion
gh run list --workflow=codeql.yml --limit=1 --json conclusion

# Confirm version
grep '"version"' package.json
```

---

## Stage 2 — RC branch + smoke gate

### 2.1  Create the RC branch locally

```sh
git checkout main && git pull origin main
git checkout -b rc/vX.Y.Z
```

The branch name MUST match `rc/**` to trigger the `freeswitch-smoke.yml`
workflow and satisfy the `Release and RC smoke gate` ruleset.

### 2.2  Push the branch

The ruleset blocks all pushes to `rc/**` until the `FreeSWITCH runtime smoke`
check is passing **for the HEAD commit** and **from a push/PR context** on the
RC ref. There is a known chicken-and-egg constraint on *initial branch
creation*:

**Workaround for initial branch creation only:**

```sh
# 1. Temporarily allow create-without-check
echo '{...}' | gh api repos/gokbilge/manageCallAI/rulesets/17115134 \
  --method PUT --input - \
  # set do_not_enforce_on_create: true

# 2. Push the branch
git push -u origin rc/vX.Y.Z

# 3. Immediately restore the ruleset (do_not_enforce_on_create: false)
echo '{...}' | gh api repos/gokbilge/manageCallAI/rulesets/17115134 \
  --method PUT --input -
```

The full JSON bodies for both calls are:

```json
{
  "name": "Release and RC smoke gate",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["refs/heads/release/**","refs/heads/rc/**"], "exclude": []}},
  "rules": [{"type": "required_status_checks", "parameters": {
    "strict_required_status_checks_policy": false,
    "do_not_enforce_on_create": true,
    "required_status_checks": [{"context": "FreeSWITCH runtime smoke"}]
  }}],
  "bypass_actors": []
}
```

Set `do_not_enforce_on_create: false` in the restore call.

After the initial branch creation push, the smoke workflow auto-triggers and
all subsequent pushes require the smoke to pass normally.

### 2.3  Monitor the smoke run

```sh
gh run list --workflow=freeswitch-smoke.yml --limit=3
gh run view <RUN_ID>
```

The run takes ~5 minutes on `enlogy@10.0.0.32`. If it fails, check container
logs:

```sh
gh run download <RUN_ID> --name freeswitch-smoke-<RUN_ID>
cat logs/smoke/api.log | tail -60
```

---

## Stage 3 — RC evidence + RC tag

### 3.1  Collect run IDs

After the smoke passes, collect:

| Field | How to get |
|---|---|
| `freeswitch_smoke_run_url` | `gh run list --workflow=freeswitch-smoke.yml --limit=1` |
| `ci_run_url` | `gh run list --workflow=ci.yml --limit=1 --json databaseId,headSha` (match RC commit SHA) |
| `codeql_run_url` | `gh run list --workflow=codeql.yml --limit=1 --json databaseId,headSha` |
| `coverage_run_url` | `gh run list --workflow=code-coverage.yml --limit=1 --json databaseId,headSha` |
| `docker_images_run_url` | `gh run list --workflow=docker-images.yml --limit=1 --json databaseId,headSha` |

### 3.2  Run supplementary gates

**Helm lint and template** (on `enlogy@10.0.0.32`):

```sh
ssh enlogy@10.0.0.32 '
~/bin/helm lint charts/managecallai/ \
  --set bootstrap.adminPassword="AtLeast12Chars!" \
  --set secrets.jwtSecret="<32-char-string>" \
  --set secrets.runtimeApiToken="<32-char-string>" \
  --set secrets.sipSecretMasterKey="<64-hex-chars>" \
  --set secrets.freeswitchEslPassword="<12-char-min>" \
  --set secrets.databaseUrl="postgres://u:p@host/db"
~/bin/helm template managecallai charts/managecallai/ \
  [same --set flags] | grep "^kind:"
'
```

Expected: `1 chart linted, 0 chart(s) failed`. All 8 resource kinds render.

**docker-compose.prod.yml smoke** (wizard path, on `enlogy@10.0.0.32`):

```sh
# Build API image locally (uses the setup.html build fix)
ssh enlogy@10.0.0.32 'cd ~/manageCallAI && docker compose build api'

# Tag as the expected GHCR image name
ssh enlogy@10.0.0.32 'docker tag managecallai-api:local ghcr.io/gokbilge/managecallai-api:vX.Y.Z'

# Create minimal .env.production (wizard mode — no SETUP_* vars)
# DATABASE_URL must use Docker service name "postgres", not localhost
# Start with --pull never to use locally-built image
ssh enlogy@10.0.0.32 '
export POSTGRES_PASSWORD=<pw>
export POSTGRES_DB=managecallai_smoke
export POSTGRES_USER=managecallai
export MANAGECALLAI_IMAGE_TAG=vX.Y.Z
export API_PORT=3001
docker pull postgres:17-alpine
docker compose -f docker-compose.prod.yml up -d postgres api --pull never
# Wait for /health then verify:
curl http://localhost:3001/health          # expect {"status":"ok","subsystems":{"db":{"status":"ok",...}}}
curl -o /dev/null -w "%{http_code}" http://localhost:3001/setup  # expect 200

docker compose -f docker-compose.prod.yml down -v
rm .env.production
'
```

Note: if GHCR packages are **public**, you can skip the `docker tag` step and
set `MANAGECALLAI_IMAGE_TAG` to the actual published tag. To make packages
public: GitHub → Profile → Packages → select package → Change visibility.

**Rotation rehearsal config check:**

```sh
ssh enlogy@10.0.0.32 'cd ~/manageCallAI && pnpm rotation:rehearsal --check-config'
# expect: rotation rehearsal configuration check passed
```

### 3.3  Write the RC evidence manifest

Create `docs/release/release-evidence-vX.Y.Z-rc.N.json` modelled on
`docs/release/release-evidence-v0.3.5-rc.1.json`. Key fields:

- `release_version`, `commit_sha` (RC branch HEAD), `stage: "rc"`
- All CI/smoke run URLs collected in 3.1
- `slice_XX_evidence` section documenting SLICE deliverables
- `known_gaps_before_production` — any gates deferred to production promotion

### 3.4  Tag the RC

The RC tag should point to the smoke-tested commit (NOT the evidence commit,
since the evidence goes on `main` and the ruleset would block pushing an
extra commit to `rc/**` without re-running smoke).

```sh
git checkout rc/vX.Y.Z
git reset --hard <SMOKE_TESTED_SHA>
git tag -a vX.Y.Z-rc.N -m "vX.Y.Z-rc.N — <description>"
git push origin vX.Y.Z-rc.N
```

Pushing the tag triggers `docker-images.yml` which publishes GHCR images
tagged `vX.Y.Z-rc.N`.

### 3.5  Merge the RC evidence to main

```sh
git checkout main && git pull
git checkout -b chore/vX.Y.Z-rcN-evidence
# copy evidence file, commit
git push -u origin chore/vX.Y.Z-rcN-evidence
gh pr create ...
```

CI is skipped for docs-only PRs (`paths-ignore: docs/**`). Trigger it manually:

```sh
gh workflow run ci.yml --ref chore/vX.Y.Z-rcN-evidence
```

Main branch protection requires `build-test`, `analyze (go)`,
`analyze (javascript-typescript)` before merge. If `enforce_admins` blocks
the merge after all checks pass:

```sh
# Temporarily disable enforce_admins
gh api repos/gokbilge/manageCallAI/branches/main/protection/enforce_admins \
  --method DELETE
gh pr merge <PR> --squash --admin ...
# Re-enable immediately
gh api repos/gokbilge/manageCallAI/branches/main/protection/enforce_admins \
  --method POST
```

### 3.6  Create the GitHub prerelease

```sh
gh release create vX.Y.Z-rc.N \
  --title "vX.Y.Z-rc.N — <short description>" \
  --prerelease \
  --notes "..."
```

---

## Stage 4 — Production evidence + production tag

### 4.1  Confirm remaining gates

Run any gates listed in `known_gaps_before_production` from the RC manifest.
Typical gates:

- `docker-compose.prod.yml` smoke with actual GHCR images (requires public packages)
- Live rotation rehearsal (`pnpm rotation:rehearsal` — not just `--check-config`)
- Docker Hub secrets configured (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`)

### 4.2  Write the production evidence manifest

Create `docs/release/release-evidence-vX.Y.Z.json` modelled on
`docs/release/release-evidence-v0.3.5.json`. Set `stage: "production"`. The
`rc_evidence_reference` field should point to the RC manifest.

### 4.3  Merge production evidence to main and tag

Same PR flow as 3.5. After the PR is merged and `main` is updated:

```sh
git checkout main && git pull
git tag -a vX.Y.Z -m "vX.Y.Z — <description>"
git push origin vX.Y.Z
```

### 4.4  Create the production GitHub release

```sh
gh release create vX.Y.Z \
  --title "vX.Y.Z — <description>" \
  --notes "..."
```

Do NOT use `--prerelease`.

---

## Stage 5 — Update public-facing pages

After the production tag and GitHub release are published, update:

### 5.1  CHANGELOG.md

Move the `## [Unreleased]` content to `## [X.Y.Z] - YYYY-MM-DD`:

- Change `Release classification` from "prerelease" to "production release"
- Remove the "No new production evidence" known limitation
- Add `Production evidence: docs/release/release-evidence-vX.Y.Z.json`
- Add any `### Fixed` entries for bugs found and fixed during this release session
- Add `### Remaining operator steps` if any post-release manual gates remain
- Leave `## [Unreleased]` as an empty placeholder above the released section

### 5.2  README.md

Update the **Release posture** section:

```md
**Current release: vX.Y.Z** (YYYY-MM-DD) — <short description>.

Evidence: [docs/release/release-evidence-vX.Y.Z.json](docs/release/release-evidence-vX.Y.Z.json)
```

Ensure `docs/ops/release-process.md` is linked.

### 5.3  GitHub repository About

Update the repository description and website if relevant:

```sh
gh api repos/gokbilge/manageCallAI \
  --method PATCH \
  -f description="<updated description if needed>"
```

### 5.4  GitHub release notes

The release notes are set when running `gh release create`. If you need to
edit them after the fact:

```sh
gh release edit vX.Y.Z --notes "..."
```

### 5.5  Update release tracking docs

After every production release, update these files in-place:

- `docs/release/product-release-audit.md` — update the header fields, gate summary, and distribution table. This is a **living document**, not a versioned copy. Prior state is in git history.
- `docs/release/evidence-inheritance-policy.md` — update "Current release", increment ages, add any new gates to "Scheduled re-runs".
- `docs/release/release-checklist.md` — update "Latest evidenced production tag" and release history.
- `docs/planning/open-release-blockers.md` — update Current Release Stage block, add shipped section.
- `install.sh` — update the `VERSION` default to the new release tag.

Do not create version-suffixed copies of `product-release-audit.md`. The file's git history is the archive.

### 5.6  Commit the docs updates

README and CHANGELOG are committed files. Put them in a PR and merge:

```sh
git checkout -b chore/vX.Y.Z-post-release-docs
git add README.md CHANGELOG.md
git commit -m "docs: update README and CHANGELOG for vX.Y.Z release"
git push -u origin chore/vX.Y.Z-post-release-docs
gh pr create ...
# trigger CI manually if needed (docs-only PRs skip CI via paths-ignore):
gh workflow run ci.yml --ref chore/vX.Y.Z-post-release-docs
# merge (disable enforce_admins if needed):
gh pr merge <PR> --squash --admin ...
```

### 5.7  Distribution: make GHCR packages public and run install smoke

After the production tag is pushed and Docker images are published:

**Make packages public** (required once per package, or when new packages are added):

```sh
# Requires write:packages scope — refresh if needed:
gh auth refresh -s write:packages

# Then set each package to public via the GitHub web UI:
# GitHub → Profile → Packages → managecallai-* → Package settings → Change visibility → Public
```

Packages: `managecallai-api`, `managecallai-web`, `managecallai-mcp`,
`managecallai-worker`, `managecallai-freeswitch-agent`.

**Run the external install smoke test:**

```sh
MANAGECALLAI_VERSION=vX.Y.Z ./scripts/external-install-smoke.sh
```

This script:
1. Pulls the public GHCR image — verifies distribution is reachable
2. Starts postgres + api with a minimal `.env`
3. Waits for `/health` to return `ok`
4. Verifies `/setup` returns 200 (wizard mode)
5. Tears down completely

Record the result in `product-release-audit.md` under Distribution readiness.

---

## Evidence manifest quick-reference

| Field | Source |
|---|---|
| `freeswitch_smoke_run_url` | RC smoke run on `rc/vX.Y.Z` |
| `ci_run_url` | CI run on RC commit SHA |
| `codeql_run_url` | CodeQL run on RC commit SHA |
| `coverage_run_url` | Coverage run on RC commit SHA |
| `docker_images_run_url` | docker-images run on RC tag |
| `helm_lint` | manual on enlogy@10.0.0.32 |
| `docker_compose_prod_smoke` | manual on enlogy@10.0.0.32 |
| `rotation_rehearsal` | `pnpm rotation:rehearsal --check-config` |

---

## Known ruleset constraints

| Constraint | Details |
|---|---|
| Ruleset ID | `17115134` — "Release and RC smoke gate" |
| Required check | `FreeSWITCH runtime smoke` |
| `do_not_enforce_on_create` | `false` by default; must be temporarily `true` for initial branch creation |
| `enforce_admins` on `main` | `true`; must be temporarily disabled to merge docs PRs when workflow_dispatch checks don't satisfy the PR merge gate |
| No bypass actors | `current_user_can_bypass: never` — no shortcut |

---

## Smoke gate server

Self-hosted runner: `enlogy@10.0.0.32` with labels `[self-hosted, freeswitch]`.

Required tools: Docker Engine, Docker Compose v2, Go toolchain, pnpm 10, helm
(install to `~/bin` if absent — `curl -fsSL https://get.helm.sh/helm-vX.X.X-linux-amd64.tar.gz | tar xz -C /tmp && mv /tmp/linux-amd64/helm ~/bin/`).
