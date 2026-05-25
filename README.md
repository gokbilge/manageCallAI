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
- A Go FreeSWITCH runtime agent
- Lua call helpers inside the FreeSWITCH boundary

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
- FreeSWITCH Runtime Agent: Go
- FreeSWITCH Call Helper: Lua
