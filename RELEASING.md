# Release process

This document describes the steps to cut a release of manageCallAI.

## Versioning

The repo uses a single version tag for the monorepo (`v0.x.0`). Docker images and the SDK
are published from the same tag. Increment:

- **patch** (`v0.x.1`) — bug fixes, dependency updates, doc-only changes
- **minor** (`v0.x.0`) — new routes, new MCP tools, new webhook events, migration additions
- **major** (`v1.0.0`) — breaking API or contract changes (remove/rename fields, change enums)

Breaking changes require a deprecation notice in the previous minor release.

---

## Pre-release checklist

Run through this before tagging. All gates must be green.

### CI

- [ ] All CI required checks pass on the release branch
- [ ] `pnpm audit --audit-level=high` clean — no new CVEs
- [ ] CodeQL scan clean

### Contracts and schema

- [ ] `docs/api/openapi.yaml` is up to date — `node scripts/generate-openapi.mjs` produces no diff
- [ ] `packages/sdk/src/generated/schema.ts` committed and current
- [ ] `scripts/check-mcp-schemas.mjs` exits 0
- [ ] `scripts/check-webhook-payloads.mjs` exits 0
- [ ] `scripts/check-api-key-capabilities.mjs` exits 0
- [ ] `scripts/check-openapi-coverage.mjs` exits 0
- [ ] No `PATH_REF_RENAMES` entries added since last release (count must not grow)

### Database

- [ ] Migrations are numbered sequentially — no gaps in `db/migrations/`
- [ ] Each new migration is additive or has a documented rollback path

### Docker

- [ ] `docker-images.yml` matrix matches `ci.yml` matrix
- [ ] All five images build locally: `api`, `worker`, `mcp`, `mcp-server`, `freeswitch-agent`

### Audit

- [ ] `docs/audit/audits/<date>-<milestone>.md` written and committed
- [ ] All open findings linked to GitHub issues
- [ ] `CLAUDE.md` `Open findings` pointer updated to the new audit file

---

## Tagging and publishing

```sh
# 1. Ensure main is clean and CI is green
git checkout main && git pull

# 2. Bump the version in the three publishable packages
#    (contracts, sdk, and the root package.json if it carries a version)
pnpm version --no-git-tag-version <patch|minor|major>
pnpm --filter @managecallai/contracts version --no-git-tag-version <same>
pnpm --filter @managecallai/sdk version --no-git-tag-version <same>

# 3. Regenerate the SDK types (version bump may not change schema, but keeps build deterministic)
pnpm --filter @managecallai/contracts build
pnpm --filter @managecallai/sdk generate

# 4. Commit the version bumps
git add package.json packages/contracts/package.json packages/sdk/package.json \
        packages/sdk/src/generated/schema.ts
git commit -m "chore: release vX.Y.Z"

# 5. Tag
git tag vX.Y.Z

# 6. Push (triggers docker-images.yml and sdk-publish.yml)
git push origin main --tags
```

---

## What the tag triggers

| Workflow | Artefact | Registry |
|----------|----------|----------|
| `docker-images.yml` | `managecallai-api` | `ghcr.io/gokbilge/managecallai-api:vX.Y.Z` |
| `docker-images.yml` | `managecallai-worker` | `ghcr.io/gokbilge/managecallai-worker:vX.Y.Z` |
| `docker-images.yml` | `managecallai-mcp` | `ghcr.io/gokbilge/managecallai-mcp:vX.Y.Z` |
| `docker-images.yml` | `managecallai-mcp-server` | `ghcr.io/gokbilge/managecallai-mcp-server:vX.Y.Z` |
| `docker-images.yml` | `managecallai-freeswitch-agent` | `ghcr.io/gokbilge/managecallai-freeswitch-agent:vX.Y.Z` |
| `sdk-publish.yml` | `@managecallai/sdk` | `https://npm.pkg.github.com` |

All Docker images also receive a `latest` tag when pushed from `main`.

---

## Post-release verification

- [ ] All GHCR images visible at `ghcr.io/gokbilge/managecallai-*:vX.Y.Z`
- [ ] `@managecallai/sdk@vX.Y.Z` visible in GitHub Packages
- [ ] `docker-compose.yml` image references in staging updated to new tag
- [ ] No `latest` tag used in production `docker-compose.yml` — pin to `vX.Y.Z`
- [ ] Release notes published on the GitHub release page (auto-generated from tag, edit to add highlights)

---

## Rollback

If a release needs to be pulled:

1. Identify the last good tag (`git tag --sort=-version:refname | head -5`)
2. Redeploy Docker images pinned to the previous tag
3. If a migration was applied, assess rollback safety — most migrations are additive and
   the application can run against the previous schema while a fix is prepared
4. Do **not** delete published Docker image tags — retag the previous good version as `latest`
   instead
5. Open a `fix:` PR against `main`, not `main` directly
