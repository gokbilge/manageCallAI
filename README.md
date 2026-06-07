# manageCallAI

[![CI](https://github.com/gokbilge/manageCallAI/actions/workflows/ci.yml/badge.svg)](https://github.com/gokbilge/manageCallAI/actions/workflows/ci.yml)

AI-native telecom control plane over FreeSWITCH with REST, MCP, n8n, visual IVR, validation, simulation, rollback, runtime safety controls, and bounded AI operator workflows.

manageCallAI is an open-source platform for building programmable PBX, IVR, and telecom automation systems on top of stock FreeSWITCH. The control plane lives in TypeScript and PostgreSQL. FreeSWITCH remains runtime-only. Lua remains thin. The Go agent handles ESL/runtime integration. v0.6 introduces assistive AI workflows grounded in API-owned records — call failure explanation, route risk analysis, recording summary review, and natural-language reporting — without autonomous runtime control.

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
- **v0.6 AI operator workflows**: bounded call failure explanation, route and change risk analysis, recording/voicemail summary review, and natural-language telecom reporting

## Release posture

**Current release: v0.6.2** (2026-06-06) — combined AI-expansion + end-user comms release. v0.6.1 scope merged into v0.6.2.

Evidence: [docs/release/release-evidence-v0.6.2.json](docs/release/release-evidence-v0.6.2.json)

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

## Licensing and editions

manageCallAI is currently licensed under the **Apache License, Version 2.0**.

Existing Apache-2.0 releases remain available under that license and are not
retroactively changed by any future decision.

The project is preparing a **Free / Pro / Enterprise** packaging model. Future
versions may use Apache-2.0 core with commercial modules, AGPL/commercial dual
licensing, or another maintainer-approved model. The licensing model will be
documented and decided before any change is made.

For full details see:

- [`LICENSING.md`](LICENSING.md) — current status and options under consideration
- [`docs/commercial/license-options.md`](docs/commercial/license-options.md) — license model comparison
- [`docs/commercial/open-source-and-commercial-boundary.md`](docs/commercial/open-source-and-commercial-boundary.md) — Free / Pro / Enterprise scope

## Repository split and public core publishing

This repository is the **public Free/Core edition**. Future Pro and Enterprise
work happens in private repositories. Public releases are produced through an
allowlist-based export process so that no private implementation, signing keys,
or commercial contracts can accidentally reach the public history.

The five-repository model:

| Repo | Purpose |
|------|---------|
| `gokbilge/manageCallAI` (this repo) | Public Free/Core — Apache-2.0 |
| `gokbilge/manageCallAI-internal` | Full internal monorepo (private) |
| `gokbilge/manageCallAI-commercial` | Pro/commercial modules (private) |
| `gokbilge/manageCallAI-enterprise` | Enterprise modules (private) |
| `gokbilge/manageCallAI-license-service` | License generation and activation (private) |

For architecture, export process, and allowlist/denylist definitions see:

- [`docs/repo-split/`](docs/repo-split/) — repository split docs
