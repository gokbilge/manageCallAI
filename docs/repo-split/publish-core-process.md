# Publish Core Process

Last updated: 2026-06-07.

This document defines the step-by-step process for exporting code from the
internal private monorepo and publishing it to the public `gokbilge/manageCallAI`
repository.

No private code, private migrations, signing keys, or customer data may ever
reach the public repo through this process.

---

## Overview

All development work happens in the internal private monorepo
(`gokbilge/manageCallAI-internal`). The public repo receives only sanitized,
allowlist-filtered exports. A human maintainer reviews and approves each
publication.

```
Internal monorepo (working copy)
  └── feature branches → internal main
          │
          │ 1. Create release branch
          ▼
  internal/release/vX.Y.Z
          │
          │ 2. Run export script
          ▼
  dist-public/manageCallAI/  (local temp dir)
          │
          │ 3. Run denylist + secret + schema checks
          ▼
  Validated export tree
          │
          │ 4. Maintainer reviews diff
          ▼
  Public repo (gokbilge/manageCallAI) ← push sanitized tree
          │
          │ 5. CI runs on public repo
          ▼
  Public tag + release
```

---

## Step-by-step process

### Step 1 — Create a release branch in internal monorepo

```sh
git checkout main
git pull origin main
git checkout -b release/vX.Y.Z
```

Ensure all planned changes for this public release are on this branch.

### Step 2 — Run the export script

```sh
pnpm export:public-core
```

This runs `scripts/export-public-core.mjs`, which:

- Creates (or refreshes) `dist-public/manageCallAI/`
- Copies only allowlisted files (see `docs/repo-split/public-core-allowlist.md`)
- Excludes `node_modules/`, `dist/`, `.git/`
- Excludes all denylist-matched paths
- Reports file count and any skipped items

### Step 3 — Run all validation checks

```sh
pnpm check:public-export
```

This runs `scripts/check-public-export.mjs`, which verifies:

- No private key material in any file
- No real-looking license files outside allowed examples path
- No private schema table names in SQL migrations
- No denylist path patterns present
- No private module implementation dirs present

Also run existing checks against the exported tree:

```sh
# Secret scan (run from export target)
node scripts/check-secrets.mjs

# Schema boundary check
pnpm check:schema-boundary
```

All checks must pass. Any failure blocks publication.

### Step 4 — License scan

Verify all new code files have appropriate license/copyright headers if the
project requires them. Verify no new dependencies introduce incompatible licenses
(GPL-only deps in an Apache-2.0 project require legal review).

```sh
pnpm audit --audit-level moderate
```

### Step 5 — Build and test

```sh
pnpm build
pnpm test
```

Full build and test suite must pass on the exported tree before publication.

### Step 6 — Maintainer review

The maintainer (human) reviews the diff between the previous public release and
the new export:

```sh
git diff vX.Y.Z-previous..HEAD -- .
```

Review confirms:
- No unexpected private files leaked
- Release notes are accurate
- Public docs are consistent

### Step 7 — Push to public repo

```sh
cd dist-public/manageCallAI
git remote add public https://github.com/gokbilge/manageCallAI.git
git push public main
```

Or via the publish script (to be created in v0.8.0-private-module-ready):

```sh
pnpm publish:public-core --version vX.Y.Z
```

### Step 8 — CI on public repo

The public repo's CI must pass on the pushed commit before tagging.

### Step 9 — Tag and create release

```sh
git tag vX.Y.Z
git push public --tags
```

Create a GitHub release from the tag with the public release notes.

---

## Combined dry-run command

To run steps 2 and 3 locally without pushing:

```sh
pnpm release:public-core:dry-run
```

This exports to `dist-public/manageCallAI` and runs the validation scan.
A zero exit code means the export is clean.

---

## Guardrails

| Guardrail | Script | Blocks publication if |
|-----------|--------|-----------------------|
| Denylist path scan | `check-public-export.mjs` | Any denylist path present |
| Private key scan | `check-public-export.mjs` | `-----BEGIN * PRIVATE KEY-----` found |
| Real license scan | `check-public-export.mjs` | License file without `invalid` marker |
| Schema boundary | `check-public-schema-boundary.mjs` | Private table in public migration |
| Secret defaults | `check-secrets.mjs` | Default JWT_SECRET etc. outside allowed paths |
| Build | `pnpm build` | TypeScript errors |
| Tests | `pnpm test` | Test failures |

---

## Related documents

- [`public-core-allowlist.md`](./public-core-allowlist.md)
- [`public-core-denylist.md`](./public-core-denylist.md)
- [`public-release-checklist.md`](./public-release-checklist.md)
- [`release-staging-plan.md`](./release-staging-plan.md)
