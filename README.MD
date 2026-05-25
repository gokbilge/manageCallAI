# manageCallAI

**AI-native telecom control plane over FreeSWITCH.**

manageCallAI is an open-source platform for building programmable PBX, IVR, and telecom automation systems on top of FreeSWITCH.

It is designed for humans, workflows, and AI agents.

Instead of exposing SIP, RTP, FreeSWITCH XML, ESL commands, dialplans, and low-level telecom complexity directly, manageCallAI provides safe, high-level telecom abstractions through:

- A modern React admin panel
- A visual IVR / call-flow builder
- A Node.js / TypeScript control plane
- A REST API
- An MCP server for AI agents
- n8n-compatible workflow automation
- FreeSWITCH runtime integration

The goal is simple:

> Turn telecom into safe, composable tools for humans, workflows, and AI agents.

## Canonical Project Doc

The main project design and architecture reference lives here:

- [docs/ProjectSourceOfTruth.md](docs/ProjectSourceOfTruth.md)
- [docs/README.MD](docs/README.MD)
- [docs/SRS.md](docs/SRS.md)
- [docs/DomainModel.md](docs/DomainModel.md)
- [docs/API.md](docs/API.md)
- [docs/DatabaseSchema.md](docs/DatabaseSchema.md)
- [db/README.MD](db/README.MD)
- [docs/SDD.md](docs/SDD.md)
- [docs/Architecture.md](docs/Architecture.md)

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
