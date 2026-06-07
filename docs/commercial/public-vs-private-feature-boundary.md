# Public vs Private Feature Boundary

Last updated: 2026-06-07.

This document defines the intended public Core boundary versus private
commercial candidate areas for a future open-core Free, Pro, and Enterprise
architecture.

Docs, schemas, architectural guidance, and mapping research may remain public
even when high-value implementations later move into private modules.

## Public Core features

The following capabilities are intended to remain in the public Core or Free
edition baseline:

- tenant, user, and auth foundation
- extensions
- devices
- SIP trunks
- DIDs and phone numbers
- inbound routes
- outbound routes
- basic queues
- voicemail boxes
- prompt assets
- recordings metadata
- basic call events
- basic audit log
- IVR draft, validate, simulate, publish, and rollback
- FreeSWITCH `mod_xml_curl` directory and dialplan integration
- Go FreeSWITCH agent foundation
- Lua thin executor foundation
- REST API foundation
- SDK
- basic MCP, n8n, and webhook integration
- entitlement framework
- usage metering foundation
- Free, Pro, and Enterprise docs and distribution profiles

## Private or commercial candidate features

The following are strong candidates for future private Pro or Enterprise
implementation modules, private packages, or private images:

- advanced AI workflows
- AI gateway or service integration
- advanced call failure investigation
- advanced route risk intelligence
- advanced natural-language analytics
- migration assistant implementation
- FreePBX or FusionPBX importer implementation
- Cisco CUCM migration tooling
- Avaya Aura migration tooling
- Alcatel OmniPCX migration tooling
- advanced compatibility scoring
- cutover and rollback evidence automation
- enterprise audit and export package
- compliance retention package
- SSO, SAML, and OIDC connectors
- reseller or operator reporting
- advanced billing and export package
- HA deployment automation
- certified carrier interop package
- premium dashboards
- support portal integrations
- license portal and activation tooling
- license generator and signing tooling

## Boundary rules

- Public docs may describe commercial module boundaries without exposing private
  implementation code.
- Public architecture docs may describe migration mappings and data models even
  when high-value migration execution remains private later.
- Public schemas and module interfaces may exist so the core can integrate with
  future private packages without embedding them in the repository.
- The public repository must not contain future private implementations solely
  hidden behind frontend toggles.
- FreeSWITCH remains runtime-only and must not become the commercial
  enforcement point.
- The API remains the entitlement authority.

## Fork posture

Forks can continue using public Core under the repository license, but forks do
not gain:

- official brand rights
- official support rights
- certified build rights
- official private registry access
- private modules
- official license-signing services
- enterprise migration intelligence implementations
