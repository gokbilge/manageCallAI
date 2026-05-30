# Security Policy

## Reporting

Do not open public issues for suspected vulnerabilities.

Report security issues privately through GitHub private vulnerability reporting
or directly to the project maintainers. Include:

- a clear description of the issue
- impact assessment
- reproduction steps
- affected versions or commits
- relevant logs, requests, traces, or proof of concept with secrets redacted

## Sensitive Areas

manageCallAI controls telecom configuration and runtime lookup paths, so security
reports are especially important for:

- SIP credentials and trunk configuration
- JWT signing and verification
- runtime API tokens and FreeSWITCH callback authentication
- tenant isolation and cross-tenant access control
- MCP permissions, AI-agent capabilities, and automation API keys
- webhook signing, replay protection, and delivery authenticity
- FreeSWITCH XML generation for directory, dialplan, and runtime routing
- publish, rollback, approval, and route-impact controls
- prompt/media storage, recordings, voicemail, CDRs, and customer call data

Telecom systems are routinely exposed to SIP scanners, toll-fraud attempts, and
automation abuse. Treat credential leakage, route manipulation, weak tenant
boundaries, and unsafe runtime XML as high-impact issues.

## Expectations

- Raw SIP trunk secrets must not be committed or stored long-term in general JSONB
  fields.
- `.env` files, runtime tokens, JWT secrets, SIP credentials, trunk credentials,
  recordings, and customer call data must stay out of git.
- Lua should stay thin and execution-focused; business policy belongs in the API.
- MCP and automation access should remain narrower than the REST API and auditable
  by actor, tenant, and capability.
- Public issues may be used for security hardening tasks only when they do not
  reveal exploitable details.
