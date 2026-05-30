# 2026-05-29 Security Review Fixes

## Scope

Follow-up on reported auth, runtime-token, Docker-secret, MCP-contract, CI, and
architecture findings.

## Findings

### SRF-2026-05-29-001: Auth role column mismatch

Status: resolved as not reproducible in the current migration chain.

`db/migrations/0018_user_roles.sql` adds `users.role`, so
`AuthRepository.findUserByEmailAndSlug()` is not selecting a missing column in the
current schema. The remaining design debt is that legacy `roles` / `user_roles`
tables still coexist with the newer `users.role` authorization model.

### SRF-2026-05-29-002: Capability checks failed open

Status: fixed.

`hasCapability()` in API and web now denies missing or unknown roles instead of
defaulting to `tenant_admin`. API tests cover missing and unrecognized roles.

### SRF-2026-05-29-003: Runtime auth accepted query/body tokens unconditionally

Status: fixed.

Runtime auth now accepts query/body `runtime_token` only when
`ALLOW_RUNTIME_TOKEN_FALLBACK` is enabled. The flag defaults off when
`APP_ENV=production` and on outside production for existing local `mod_xml_curl`
compatibility.

### SRF-2026-05-29-004: Production startup allowed local demo secrets

Status: fixed for API and FreeSWITCH agent.

When `APP_ENV=production`, API startup rejects the sample JWT, runtime-token, and
SIP encryption-key values. The FreeSWITCH agent rejects the sample runtime token
and `ClueCon` ESL password.

### SRF-2026-05-29-005: MCP tool contracts can drift from REST and IVR schemas

Status: open follow-up.

The stale MCP IVR node-type description was corrected. Full remediation is tracked
in `SLICE-38-mcp-contract-alignment.md` because it requires choosing the canonical
MCP server and generating or drift-testing MCP JSON schemas against shared
contracts.

### SRF-2026-05-29-006: CI telecom safety gates are incomplete

Status: open follow-up.

Tracked in `SLICE-39-ci-telecom-safety-gates.md`: migration replay, runtime XML
golden tests, MCP contract checks, secret scanning, vulnerability audit, Docker
coverage, FreeSWITCH-profile smoke tests, and IVR simulation regressions.

### SRF-2026-05-29-007: API composition and DB integrity hardening

Status: open follow-up.

The review observations are valid architecture hardening items. Module grouping in
`app.ts`, polymorphic target integrity, tenant consistency checks, immutable audit
enforcement, runtime indexes, and service-level status transition tests should be
handled as separate hardening work to avoid mixing broad refactors into security
patches.

