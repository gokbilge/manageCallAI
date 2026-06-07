# Enterprise Repo Skeleton

Last updated: 2026-06-07.

This document defines the intended directory structure for the future private
`gokbilge/manageCallAI-enterprise` repository. Nothing is implemented yet.

**This repo must remain private. Do not commit private keys, customer data,
SAML signing certificates, SSO client secrets, or real license files.**

---

## Intended structure

```
manageCallAI-enterprise/
│
├── README.md                          # Private — do not publish
├── LICENSE                            # Enterprise license terms
├── package.json
├── pnpm-workspace.yaml
│
├── modules/
│   │
│   ├── sso/                           # Identity federation
│   │   ├── saml/                      # SAML 2.0 IdP integration
│   │   ├── oidc/                      # OIDC/OAuth2 integration
│   │   ├── ldap/                      # LDAP/Active Directory sync
│   │   └── package.json
│   │
│   ├── compliance-audit/              # Enterprise audit log export
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── legal-hold/                    # Legal hold automation
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── reseller-operator/             # Reseller/operator tenant management
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── migration-assistant/           # Full enterprise migration assistant
│   │   ├── cucm/                      # Cisco CUCM importer
│   │   ├── avaya/                     # Avaya importer
│   │   ├── alcatel/                   # Alcatel/Mitel importer
│   │   ├── cutover/                   # Cutover/rollback automation
│   │   ├── evidence/                  # Cutover evidence capture
│   │   └── package.json
│   │
│   ├── ha-deploy/                     # HA deployment automation
│   │   ├── cluster-registry/
│   │   ├── health-orchestration/
│   │   └── package.json
│   │
│   └── carrier-certification/         # Private carrier interop cert packs
│       ├── src/
│       └── package.json
│
├── db/
│   └── migrations/
│       └── enterprise/                # PostgreSQL managecallai_enterprise schema
│           ├── 0001_enterprise_schema_init.sql
│           └── README.md
│
├── docker/
│   ├── Dockerfile.enterprise          # Enterprise build overlay
│   └── docker-compose.enterprise-private.yml
│
├── docs/
│   ├── module-integration.md
│   ├── sso-setup.md
│   ├── migration-assistant.md
│   ├── ha-deployment.md
│   └── release-process.md
│
└── scripts/
    ├── build-enterprise.mjs
    └── validate-enterprise.mjs
```

---

## SSO security rules

- SAML signing certificates and SSO client secrets must never be committed.
- Use secret manager / environment injection for all IdP credentials.
- The SSO module reads certificate material from environment or HSM at runtime.
- Certificate rotation procedures must be documented, not scripted with live keys.

---

## Migration assistant rules

- Importer modules must only store migration project metadata in the DB.
- Source-system credentials (CUCM admin, Avaya credentials) must not be committed.
- Carrier certification packs contain only test results and configuration
  evidence, not production carrier credentials.

---

## Schema rules

- All tables in `db/migrations/enterprise/` must be in the
  `managecallai_enterprise` PostgreSQL schema.
- May reference public tenant/user IDs as foreign keys.
- Must not modify public core tables directly without following the documented
  extension column policy.

---

## Related documents

- [`private-repo-map.md`](./private-repo-map.md)
- [`../commercial/private-migration-contract.md`](../commercial/private-migration-contract.md)
- [`../commercial/private-schema-extension-policy.md`](../commercial/private-schema-extension-policy.md)
