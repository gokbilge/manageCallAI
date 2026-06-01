# manageCallAI

[![CI](https://github.com/gokbilge/manageCallAI/actions/workflows/ci.yml/badge.svg)](https://github.com/gokbilge/manageCallAI/actions/workflows/ci.yml)

**AI-native telecom control plane over FreeSWITCH with MCP, n8n, REST API, visual IVR, validation, simulation, and rollback.**

manageCallAI is an open-source platform for building programmable PBX, IVR, and telecom automation systems on top of FreeSWITCH.

It is designed for humans, workflows, and AI agents.

Instead of exposing SIP, RTP, FreeSWITCH XML, ESL commands, dialplans, and low-level telecom complexity directly, manageCallAI provides safe, high-level telecom abstractions through:

- A modern React admin panel
- A visual IVR / call-flow builder
- A Node.js / TypeScript control plane
- A REST API
- A TypeScript MCP server for AI agents
- n8n-compatible workflow automation
- A Go FreeSWITCH adapter service
- Minimal Lua helpers inside stock FreeSWITCH

The goal is simple:

> Turn telecom into safe, composable tools for humans, workflows, and AI agents.

## Canonical Project Doc

The main project design and architecture reference lives here:

- [docs/architecture/source-of-truth.md](docs/architecture/source-of-truth.md)
- [docs/README.md](docs/README.md)
- [docs/requirements/srs.md](docs/requirements/srs.md)
- [docs/design/domain-model.md](docs/design/domain-model.md)
- [docs/api/rest-api.md](docs/api/rest-api.md)
- [docs/design/database-schema.md](docs/design/database-schema.md)
- [db/README.md](db/README.md)
- [docs/design/software-design.md](docs/design/software-design.md)
- [docs/architecture/overview.md](docs/architecture/overview.md)
- [docs/development/demo-loop.md](docs/development/demo-loop.md)
- [docs/development/ivr-flow-foundation-proof.md](docs/development/ivr-flow-foundation-proof.md)
- [docs/development/ivr-runtime-resolver-proof.md](docs/development/ivr-runtime-resolver-proof.md)
- [docs/development/first-vertical-slice.md](docs/development/first-vertical-slice.md)
- [docs/development/live-freeswitch-registration.md](docs/development/live-freeswitch-registration.md)
- [docs/development/live-freeswitch-ivr-loop.md](docs/development/live-freeswitch-ivr-loop.md)
- [docs/ivr/IVR_ARCHITECTURE.md](docs/ivr/IVR_ARCHITECTURE.md)
- [docs/planning/README.md](docs/planning/README.md)
- [packages/sdk/README.md](packages/sdk/README.md)

If other documents drift, the source-of-truth document is the canonical reference until updated.

## Why manageCallAI?

Traditional PBX platforms are usually built for manual administration.

manageCallAI replaces low-level telecom administration with safe business-level operations for:

- Human operators
- Workflow systems
- AI agents

## Current Status

**Alpha candidate. Not production-ready.**

manageCallAI is suitable for local demos, internal evaluation, and contributor
testing. Production deployment is not recommended until the beta/production
gates in the release docs are complete.

Release readiness references:

- [docs/release/public-alpha-readiness.md](docs/release/public-alpha-readiness.md)
- [docs/deployment/local-alpha.md](docs/deployment/local-alpha.md)
- [docs/planning/production-readiness-roadmap.md](docs/planning/production-readiness-roadmap.md)
- [docs/release/release-checklist.md](docs/release/release-checklist.md)

Core API domains are implemented and covered by CI, with the current generated
contract covering 99 OpenAPI operations.

### Implemented

- **Auth**: multi-tenant register / login, JWT with role claim, platform admin support
- **Extensions**: CRUD + AES-256-GCM encrypted SIP credentials
- **SIP Trunks, Phone Numbers, Schedules, Outbound Routes**: full CRUD
- **Call Groups, Queues**: CRUD + member management (simultaneous / sequential ring strategies)
- **Voicemail Boxes**: CRUD + greeting prompt assignment
- **Prompt Assets**: metadata CRUD; provider-neutral TTS generation contract (provider-work)
- **IVR Flows**: draft -> validate -> simulate -> publish -> rollback, approval gating, full history
- **Inbound Routes**: draft -> publish lifecycle with version control
- **Runtime (IVR)**: live session start/advance; FreeSWITCH Lua executor closes the loop
- **Outbound Calls**: dispatch via outbound route resolution, route policy, and tenant fraud policy checks
- **Call Events**: ingestion from Go ESL agent + tenant query
- **Recordings**: metadata ingestion + analysis request contract (transcript / summary)
- **Automation**: API key management + webhook subscriptions + durable delivery queue
- **Users**: tenant user CRUD + role management
- **Approvals**: approval-gating for IVR publish/rollback
- **Audit, Export**: read access + tenant data export
- **Channels**: account, message, and meeting-session adapters (WhatsApp / Telegram / Google Meet)
- **IVR AI**: provider-neutral AI turn contract
- **Platform ops**: tenant list, runtime health, session summary, and FreeSWITCH node registry (platform_admin)
- **FreeSWITCH integration**: `mod_xml_curl` directory + dialplan endpoints; Go ESL adapter; node-scoped HMAC runtime auth
- **Fraud and runtime safety**: tenant outbound policy, security alerts, token redaction, production preflight, rate-limit topology, soak/SLO/carrier/release-evidence gates
- **MCP server**: safe read, draft mutation, validation, simulation, approval-request, and export tools for AI agents
- **n8n connector**: webhook trigger + API action patterns
- **Schema contracts**: Zod schemas as single source of truth; OpenAPI spec generated from code
- **Error standard**: gRPC-inspired RPC codes, global error handler, CI coverage gate

### Planned / In Progress

- SLICE-34: Fastify Zod type provider (controller validation migrated to contracts schemas)
- SDK npm publish/versioning workflow

**Run the full demo loop in one sitting:**

```text
docs/development/demo-loop.md
```

The initial target is a safe IVR and routing control plane where an AI agent or workflow can create, validate, simulate, and publish a working IVR on FreeSWITCH without direct knowledge of FreeSWITCH internals.

The IVR architecture and foundation runbook now live here:

- [docs/ivr/IVR_ARCHITECTURE.md](docs/ivr/IVR_ARCHITECTURE.md)
- [docs/development/ivr-flow-foundation-proof.md](docs/development/ivr-flow-foundation-proof.md)
- [docs/development/ivr-runtime-resolver-proof.md](docs/development/ivr-runtime-resolver-proof.md)
- [docs/development/live-freeswitch-ivr-loop.md](docs/development/live-freeswitch-ivr-loop.md)

The current IVR foundation now includes:

- tenant-scoped IVR flow + version CRUD
- structural validation
- deterministic draft/version simulation
- approval-aware publish / rollback attempts

## Technology Stack

- Frontend: React + TypeScript
- Main API / Control Plane: Node.js + TypeScript
- Database: PostgreSQL
- Workflow: n8n + Webhooks
- AI: MCP server in TypeScript
- FreeSWITCH Adapter Service: Go
- FreeSWITCH Call Helper: Lua

## FreeSWITCH Strategy

manageCallAI does not fork or replace FreeSWITCH.

It runs on top of stock FreeSWITCH through supported extension interfaces:
`mod_xml_curl`, `ESL` / `mod_event_socket`, and Lua helpers.

This is much better for adoption because users can bring their existing FreeSWITCH installation.

My recommendation:

1. Use stock FreeSWITCH.
2. Do not fork.
3. Build a FreeSWITCH adapter service.
4. Build Lua helper scripts as thin executors only.
5. Build an `xml_curl` config provider.
6. Build an ESL event/control layer.
7. Provide a Dockerized reference FreeSWITCH runtime.

## Project Philosophy

- Business logic: manageCallAI backend
- AI / MCP / n8n logic: manageCallAI backend
- Call execution: FreeSWITCH
- Optional call-session helper: Lua
- Runtime event/control agent: Go or Node

## Quick Start

```sh
# Start core services
pnpm db:up
pnpm db:migrate
pnpm --filter @managecallai/api dev

# With FreeSWITCH runtime
pnpm runtime:up
```

Runbooks:
- **Demo loop**: `docs/development/demo-loop.md`
- **Live IVR proof**: `docs/development/live-freeswitch-ivr-loop.md`
- **IVR architecture**: `docs/ivr/IVR_ARCHITECTURE.md`
- **Node support matrix**: `docs/ivr/NODE_SUPPORT_MATRIX.md`

## FreeSWITCH Strategy

manageCallAI does not fork or replace FreeSWITCH. It runs on top of stock FreeSWITCH through supported extension interfaces: `mod_xml_curl`, ESL / `mod_event_socket`, and Lua helpers.

**Lua helpers are thin executors only** -- they carry out runtime actions (play, collect, transfer, hangup) and call back to the API. All business logic lives in the Node.js control plane.
