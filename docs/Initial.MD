> Superseded by `docs/ProjectSourceOfTruth.md` as the canonical project reference.
>
> Keep this file only as an early brainstorming artifact unless its useful content is merged back into the source-of-truth document.

manageCallAI is currently in early design and development.

The initial milestone is:

An AI agent or n8n workflow can safely create, validate, simulate, and publish a working IVR on FreeSWITCH without knowing FreeSWITCH internals.

MVP Scope

The first MVP should support:

Single tenant
Extensions
One SIP trunk
Inbound route
Basic outbound route
Prompt upload
Visual IVR flow
Flow validation
Flow simulation
Publish and rollback
FreeSWITCH dynamic dialplan
CDR ingestion
Call event timeline
Read-only MCP tools
Draft/simulate MCP tools
n8n webhook examples
What This Project Is Not

manageCallAI is not:

A SIP server
A media server
A FreeSWITCH replacement
A billing platform
A softphone
A raw ESL command panel
A low-level dialplan editor only

manageCallAI is:

A control plane
A flow platform
An AI-safe telecom abstraction layer
A modern PBX management platform
An MCP-enabled telecom automation layer
Security Philosophy

Telecom systems are sensitive.

manageCallAI is designed with safety-first principles:

No raw FreeSWITCH command access for AI agents
No direct XML editing through MCP
No production publish without validation
Optional human approval before risky changes
Full audit trail for every change
Tenant-scoped access
Destination allowlists
Route-impact analysis
Rollback-first publishing model
Contributing

Contributions are welcome.

Good first contribution areas:

Flow schema design
React Flow UI prototype
FreeSWITCH mod_xml_curl examples
ESL event listener
MCP tool definitions
n8n workflow examples
Documentation
Test call scenarios

Before opening a pull request, please make sure:

Code is typed
Tests are included where possible
Changes are documented
Security impact is considered
Telecom behavior is validated with a test scenario
Roadmap
Milestone 1 — FreeSWITCH Control Plane
Dynamic extension lookup
Dynamic inbound routing
Basic outbound routing
CDR ingestion
Call event timeline
Milestone 2 — Visual IVR
Flow schema
Visual builder
Prompt manager
Publish/rollback
Flow simulator
Milestone 3 — MCP
MCP server
Read-only tools
Draft creation tools
Validation tools
Simulation tools
Approval-gated publishing
Milestone 4 — n8n
Webhook events
Example workflows
OpenAPI spec
Custom n8n nodes
Milestone 5 — Production Hardening
Multi-tenant isolation
RBAC
Audit logs
Policy engine
HA-ready FreeSWITCH support
Monitoring and alerting
License

This project is intended to be released as open source.

Recommended licenses:

AGPL-3.0 if you want improvements to hosted/SaaS versions to remain open.
Apache-2.0 if you want maximum commercial adoption.
MPL-2.0 if you want a balanced file-level copyleft model.

Final license decision is pending.
