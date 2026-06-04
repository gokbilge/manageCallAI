# manageCallAI

[![CI](https://github.com/gokbilge/manageCallAI/actions/workflows/ci.yml/badge.svg)](https://github.com/gokbilge/manageCallAI/actions/workflows/ci.yml)

AI-native telecom control plane over FreeSWITCH with REST, MCP, n8n, visual IVR, validation, simulation, rollback, and runtime safety controls.

manageCallAI is an open-source platform for building programmable PBX, IVR, and telecom automation systems on top of stock FreeSWITCH. The control plane lives in TypeScript and PostgreSQL. FreeSWITCH remains runtime-only. Lua remains thin. The Go agent handles ESL/runtime integration.

## Canonical docs

- [docs/architecture/source-of-truth.md](docs/architecture/source-of-truth.md)
- [docs/architecture/overview.md](docs/architecture/overview.md)
- [docs/architecture/runtime-boundaries.md](docs/architecture/runtime-boundaries.md)
- [docs/design/software-design.md](docs/design/software-design.md)
- [docs/design/domain-model.md](docs/design/domain-model.md)
- [docs/design/database-schema.md](docs/design/database-schema.md)
- [docs/design/setup-bootstrap.md](docs/design/setup-bootstrap.md)
- [docs/README.md](docs/README.md)

## Implemented in the repository

Source inspection shows implemented support for:

- multi-tenant auth and tenant-scoped PBX objects
- extensions, trunks, phone numbers, schedules, inbound/outbound routes
- queues, call groups, voicemail boxes, prompt assets, recordings, and call events
- IVR draft, validate, simulate, publish, rollback, and approval-aware flows
- FreeSWITCH directory and dialplan callbacks over `mod_xml_curl`
- Go FreeSWITCH agent runtime/event integration
- tenant and platform runtime visibility surfaces
- feature codes, parking, conference rooms, runtime apply requests, and end-user self-service
- first-run setup/bootstrap through `/setup` or headless `SETUP_*` environment variables
- deployment packaging with `docker-compose.prod.yml`, `install.sh`, and a Helm chart scaffold

## Release posture

**Current release: v0.4.0** (2026-06-05) — v0.4 competitive baseline.

Evidence: [docs/release/release-evidence-v0.4.0.json](docs/release/release-evidence-v0.4.0.json)

Release posture must be derived from release evidence, not from source inspection alone.

- Implementation in the tree is not evidence.
- Scripts, templates, and `--check-config` modes are not evidence.
- Production claims require artifacts tied to the release-candidate commit and workflow runs.

Use these documents for current stage and blockers:

- [docs/release/release-checklist.md](docs/release/release-checklist.md)
- [docs/release/product-release-audit.md](docs/release/product-release-audit.md)
- [docs/ops/release-process.md](docs/ops/release-process.md)
- [docs/planning/open-release-blockers.md](docs/planning/open-release-blockers.md)

## Architecture summary

```text
React Web UI
   -> REST API
      -> PostgreSQL desired state
      -> validation / simulation / publish / rollback / audit
      -> runtime artifact generation
      -> FreeSWITCH mod_xml_curl directory/dialplan
      -> Lua thin executor
      -> Go ESL agent
      -> call events / observability

MCP / n8n
   -> safe API abstractions only
```

## Quick start

```sh
pnpm install
pnpm db:up
pnpm db:migrate
pnpm --filter @managecallai/api dev
```

For packaging and first boot:

- [docs/ops/quickstart.md](docs/ops/quickstart.md)
- [docker-compose.prod.yml](docker-compose.prod.yml)
- [.env.production.example](.env.production.example)
- [install.sh](install.sh)

manageCallAI is not production-ready unless all production evidence gates pass with real artifacts tied to the release candidate commit.
