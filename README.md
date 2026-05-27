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
- [docs/development/first-vertical-slice.md](docs/development/first-vertical-slice.md)
- [docs/development/live-freeswitch-registration.md](docs/development/live-freeswitch-registration.md)
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

The core runtime slice is implemented and passing CI:

- Multi-tenant auth (register / login, JWT with role claim)
- Extension CRUD with AES-256-GCM encrypted SIP credentials
- FreeSWITCH `mod_xml_curl` directory endpoint
- Inbound route lookup endpoint
- Call-event ingestion from the Go ESL agent
- Role-based capability model (`tenant_admin` / `platform_admin`)
- React admin panel with tenant and platform workspaces
- Go FreeSWITCH adapter (ESL connection, event normalization)
- Docker Compose profiles separating core services from FreeSWITCH runtime

**Run the full demo loop in one sitting:**

```text
docs/development/demo-loop.md
```

The initial target is a safe IVR and routing control plane where an AI agent or workflow can create, validate, simulate, and publish a working IVR on FreeSWITCH without direct knowledge of FreeSWITCH internals.

The IVR architecture and foundation runbook now live here:

- [docs/ivr/IVR_ARCHITECTURE.md](docs/ivr/IVR_ARCHITECTURE.md)
- [docs/development/ivr-flow-foundation-proof.md](docs/development/ivr-flow-foundation-proof.md)

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

## Priority Implementation Order

1. PostgreSQL migration runnable
2. Node.js API health + extensions CRUD
3. FreeSWITCH `mod_xml_curl` directory endpoint
4. Go adapter connects to ESL and logs events
5. Lua helper only for `play_prompt` / `play_collect`
6. OpenAPI generated client
7. MCP read-only tools
8. Flow draft / validate / simulate
9. Publish active version
10. n8n webhook examples

Step 1 is now defined as:

- start PostgreSQL with `pnpm db:up`
- apply migrations with `pnpm db:migrate`
- verify status with `pnpm db:status`

The current local MVP smoke path can also be exercised with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mvp-smoke.ps1
```

The full live runtime proof is now documented here:

```text
docs/development/live-freeswitch-registration.md
```

That runbook covers:

1. API container startup
2. stock FreeSWITCH startup
3. containerized `freeswitch-agent`
4. real SIP `REGISTER`
5. persisted `registration_seen` event through the API

For MVP, use Lua only for:

- `play_collect`
- `play_prompt`
- `transfer`
- `hangup`
- `set_variable`
- call API for next step

Do not put business logic in Lua.
