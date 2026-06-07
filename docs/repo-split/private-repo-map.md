# Private Repo Map

Last updated: 2026-06-07.

This document maps future modules and capabilities to their target private
repositories. Nothing in this map is implemented yet. All items listed are
future work that must NOT be committed to the public repo.

---

## Commercial repo (`gokbilge/manageCallAI-commercial`)

### Advanced AI workflows

| Module | Description |
|--------|-------------|
| `modules/advanced-ai/` | AI-powered call analysis beyond public baseline |
| `modules/ai-gateway/` | Private AI gateway integration, vendor routing, cost management |
| `modules/ai-gateway-usage/` | AI usage metering for billing and quota enforcement |

### Pro usage reporting and metering

| Module | Description |
|--------|-------------|
| `modules/commercial-usage/` | Pro usage reporting, dashboards, export |
| `modules/add-on-enforcement/` | Server-side add-on pack enforcement extensions |
| `modules/usage-webhooks/` | Commercial usage webhook delivery |

### Migration tooling (paid tier)

| Module | Description |
|--------|-------------|
| `modules/migration-preview/` | Paid migration preview and compatibility scoring |
| `modules/migration-ai-analysis/` | AI-assisted migration analysis beyond free limits |

### Commercial export and billing

| Module | Description |
|--------|-------------|
| `modules/billing-export/` | Commercial usage data export for billing integrations |
| `modules/add-on-packs/` | Add-on pack purchase and provisioning |

### Commercial schema

| Path | Description |
|------|-------------|
| `db/migrations/commercial/` | Schema in `managecallai_commercial` PostgreSQL schema |

---

## Enterprise repo (`gokbilge/manageCallAI-enterprise`)

### Identity federation

| Module | Description |
|--------|-------------|
| `modules/sso/` | SSO connector framework |
| `modules/sso/saml/` | SAML 2.0 IdP integration |
| `modules/sso/oidc/` | OIDC/OAuth2 IdP integration |
| `modules/sso/ldap/` | LDAP/AD directory sync |

### Compliance and audit

| Module | Description |
|--------|-------------|
| `modules/compliance-audit/` | Enterprise audit log export |
| `modules/legal-hold/` | Legal hold automation and retention enforcement |
| `modules/compliance-export/` | Compliance report generation |
| `modules/data-retention-enterprise/` | Enterprise-grade retention policy enforcement |

### Reseller and operator

| Module | Description |
|--------|-------------|
| `modules/reseller-operator/` | Reseller/operator tenant management |
| `modules/reseller-billing/` | Reseller billing and margin reporting |
| `modules/operator-reporting/` | Operator-level reporting and analytics |

### Migration assistant (enterprise)

| Module | Description |
|--------|-------------|
| `modules/migration-assistant/` | Full enterprise migration project management |
| `modules/migration-assistant/cucm/` | Cisco CUCM importer |
| `modules/migration-assistant/avaya/` | Avaya importer |
| `modules/migration-assistant/alcatel/` | Alcatel/Mitel importer |
| `modules/migration-assistant/cutover/` | Cutover/rollback automation |
| `modules/migration-assistant/evidence/` | Cutover evidence capture |

### HA and deployment

| Module | Description |
|--------|-------------|
| `modules/ha-deploy/` | HA deployment automation and node registry |
| `modules/ha-deploy/cluster-registry/` | Multi-node cluster registry |
| `modules/ha-deploy/health-orchestration/` | Cross-node health monitoring |

### Carrier certification

| Module | Description |
|--------|-------------|
| `modules/carrier-certification/` | Private carrier interop certification evidence packs |

### Enterprise schema

| Path | Description |
|------|-------------|
| `db/migrations/enterprise/` | Schema in `managecallai_enterprise` PostgreSQL schema |

---

## License-service repo (`gokbilge/manageCallAI-license-service`)

| Component | Description |
|-----------|-------------|
| `apps/license-api/` | License issuance and activation API |
| `apps/customer-portal/` | Customer license management portal |
| `tools/license-generator/` | Offline license generation tooling |
| `tools/license-verify/` | License file verification test tools |
| `tools/key-rotation/` | License signing key rotation tooling |
| `docs/key-management/` | Key management procedures (no actual keys) |
| `docs/activation-protocol/` | Activation protocol specification |

**Key management rules:**
- Private signing keys must NEVER be committed to any git repository
- Keys must be stored in an HSM, cloud key management service, or offline secure storage
- The license generator reads keys at runtime from a secret manager
- Only public keys / verification artifacts may be committed

---

## Internal monorepo (`gokbilge/manageCallAI-internal`)

The internal monorepo is a superset of the public repo with additional:

| Path | Description |
|------|-------------|
| `docs/internal/` | Internal planning and roadmap not for public release |
| `docs/commercial/internal/` | Internal commercial docs |
| `scripts/publish/` | Public release export and publish scripts |
| `scripts/internal/` | Internal tooling |
| `integrations/commercial/` | Commercial module stubs and integration contracts |
| `integrations/enterprise/` | Enterprise module stubs |
| `integrations/license-service/` | License-service API client stubs |

---

## Public core retains

The following remain permanently in the public core and are NOT moved to
private repos:

- Core PBX objects (extensions, trunks, routes, IVR, queues, etc.)
- Public entitlement framework (migration 0077, EntitlementService)
- Public module registry interfaces
- Public edition docs
- Public schema boundary guard
- Public migration contract interfaces
- Public SDK and API contracts
- Free edition Docker profiles
- Installation scripts and Helm chart scaffold
