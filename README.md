# manageCallAI

**AI-native telecom control plane over FreeSWITCH.**

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

If other documents drift, the source-of-truth document is the canonical reference until updated.

## Why manageCallAI?

Traditional PBX platforms are usually built for manual administration.

manageCallAI replaces low-level telecom administration with safe business-level operations for:

- Human operators
- Workflow systems
- AI agents

## Current Status

The project is in early design and development.

The initial target is a safe IVR and routing control plane where an AI agent or workflow can create, validate, simulate, and publish a working IVR on FreeSWITCH without direct knowledge of FreeSWITCH internals.

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

For MVP, use Lua only for:

- `play_collect`
- `play_prompt`
- `transfer`
- `hangup`
- `set_variable`
- call API for next step

Do not put business logic in Lua.
