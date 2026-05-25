# Security Policy

## Reporting

Please do not open public issues for sensitive security findings.

Report suspected vulnerabilities privately to the project maintainers with:

- a clear description of the issue
- impact assessment
- reproduction steps
- any relevant logs, requests, or proof of concept

## Scope

Security-sensitive areas include:

- authentication and authorization
- SIP trunk credentials and secret handling
- MCP tool boundaries
- publish and rollback controls
- FreeSWITCH event/control interfaces
- webhook validation and workflow integrations

## Expectations

- Raw SIP trunk secrets should not be stored long-term in general JSONB fields.
- Lua should not contain business logic.
- MCP should remain narrower than the REST API.
