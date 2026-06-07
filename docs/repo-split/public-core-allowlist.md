# Public Core Allowlist

Last updated: 2026-06-07.

This document defines the complete set of files and directories that may be
published to the public `gokbilge/manageCallAI` repository.

The export script `scripts/export-public-core.mjs` uses this allowlist. Only
listed paths are copied to the export target. Everything else is excluded by
default.

---

## Root-level files

| Path | Required | Notes |
|------|----------|-------|
| `README.md` | yes | |
| `LICENSE` | yes | Must not be changed |
| `CONTRIBUTING.md` | yes | |
| `TRADEMARKS.md` | yes | |
| `LICENSING.md` | yes | |
| `package.json` | yes | Root workspace package.json |
| `pnpm-lock.yaml` | yes | |
| `pnpm-workspace.yaml` | yes | |
| `tsconfig.base.json` | yes | |
| `tsconfig.json` | yes | |
| `.eslintrc*` / `eslint.config.*` | yes | |
| `.prettierrc*` | optional | |
| `.gitignore` | yes | |
| `docker-compose.yml` | yes | Development compose |
| `docker-compose.prod.yml` | yes | Production compose |
| `docker-compose.free.yml` | yes | Free edition compose |
| `docker-compose.pro.yml` | yes | Pro edition compose (public interfaces) |
| `docker-compose.enterprise.yml` | yes | Enterprise edition compose (public interfaces) |
| `.env.example` | yes | |
| `.env.free.example` | yes | |
| `.env.pro.example` | yes | |
| `.env.enterprise.example` | yes | |
| `.env.production.example` | yes | |
| `install.sh` | yes | |
| `helm/` | yes | Public Helm chart scaffold |

---

## apps/

| Path | Required | Notes |
|------|----------|-------|
| `apps/api/` | yes | Core API — full contents except private module dirs |
| `apps/web/` | yes | Core web UI — full contents except private feature dirs |
| `apps/mcp/` | yes | Public MCP server baseline |
| `apps/mcp-server/` | yes | Legacy MCP server (public) |
| `apps/worker/` | yes | Core worker |
| `apps/freeswitch-agent/` | yes | FreeSWITCH ESL Go agent |

**Excluded within apps/:**
- Any subdirectory named `private/`, `commercial/`, `enterprise/`, or matching `*-private`
- `apps/api/src/modules/commercial-private/` (if created)
- `apps/api/src/modules/enterprise-private/` (if created)

---

## packages/

| Path | Required | Notes |
|------|----------|-------|
| `packages/contracts/` | yes | Public contracts and types |
| `packages/sdk/` | yes | Public SDK |
| `packages/core/` | yes | Public core utilities |
| `packages/flow-engine/` | yes | Public flow engine |
| `packages/policy/` | yes | Public policy engine |

**Excluded within packages/:**
- Any package prefixed `private-`, `commercial-`, or `enterprise-`

---

## db/

| Path | Required | Notes |
|------|----------|-------|
| `db/migrations/` | yes | Public/core migrations only — see schema boundary check |
| `db/migrate.mjs` | yes | Migration runner |
| `db/README.md` | yes | |

**Excluded within db/:**
- `db/migrations/commercial/` (private commercial migrations)
- `db/migrations/enterprise/` (private enterprise migrations)

---

## freeswitch/

| Path | Required | Notes |
|------|----------|-------|
| `freeswitch/` | yes | Full public FreeSWITCH config and scripts |

---

## docs/

| Path | Required | Notes |
|------|----------|-------|
| `docs/architecture/` | yes | |
| `docs/adr/` | yes | |
| `docs/api/` | yes | OpenAPI and REST API docs |
| `docs/audit/` | yes | Public audit records |
| `docs/commercial/` | yes | Public commercial docs (open-core boundary, entitlement) |
| `docs/deployment/` | yes | Free/Pro/Enterprise deployment guides |
| `docs/design/` | yes | |
| `docs/development/` | yes | |
| `docs/integrations/` | yes | |
| `docs/ivr/` | yes | |
| `docs/migration/` | yes | Public migration planning |
| `docs/ops/` | yes | |
| `docs/planning/` | yes | Public planning docs |
| `docs/release/` | yes | Public release evidence and notes |
| `docs/repo-split/` | yes | This directory |
| `docs/requirements/` | yes | |
| `docs/ui/` | yes | |
| `docs/user/` | yes | |
| `docs/README.md` | yes | |

**Excluded within docs/:**
- `docs/internal/` (if created — internal-only planning)
- `docs/commercial/private-*` files marked as internal-only

---

## scripts/

| Path | Required | Notes |
|------|----------|-------|
| `scripts/` | yes | All public check/validate/generate scripts |

**Excluded within scripts/:**
- `scripts/private/` (if created)
- `scripts/internal/` (if created)

---

## examples/

| Path | Required | Notes |
|------|----------|-------|
| `examples/licenses/` | yes | Only `*.invalid.json` files — no real license files |

---

## CI/CD

| Path | Required | Notes |
|------|----------|-------|
| `.github/` | yes | Public CI/CD workflows |

**Excluded within .github/:**
- Internal-only workflow files that reference private repos

---

## Usage

The export script copies only these paths. Files and directories not in this
list are excluded from the public export by default, even if they exist in the
working tree.

See `scripts/export-public-core.mjs` for implementation and
`scripts/check-public-export.mjs` for the validation scan.
