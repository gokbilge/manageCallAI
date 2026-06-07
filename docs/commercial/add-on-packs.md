# Add-On Packs (Design)

Add-on packs are planned entitlement extensions for Pro and Enterprise tenants.
They allow per-tenant capacity expansion beyond base plan limits without a full
plan upgrade. No payment processing is integrated; provisioning is an
administrative operation via `tenant_entitlement_overrides`.

No add-on packs are active or enforced in v0.7.5. This document describes the
intended design.

## Planned Packs

### Extension Pack
- Adds **+100 extensions** per pack
- Capability key: `extension.max_count`
- Example: Pro base (250) + 2 packs = 450 extensions

### DID Pack
- Adds **+100 DIDs** per pack
- Capability key: `did.max_count`

### IVR Pack
- Adds **+25 IVR flows** per pack
- Capability key: `ivr.flow.max_count`

### Queue Pack
- Adds **+10 queues** per pack
- Capability key: `queue.max_count`

### Recording Storage Pack
- Adds **+50 GB (51,200 MB)** recording storage per pack
- Capability key: `recording.storage_mb`

### AI Summaries Pack
- Adds **+1,000 AI summaries/month** per pack
- Capability key: `ai.summary.monthly_limit`

### Migration Runs Pack
- Adds **+5 migration analyses/month** and **+5 draft imports/month** per pack
- Capability keys: `migration.analysis.monthly_limit`, `migration.draft_import.monthly_limit`

## How Packs Are Applied

Packs are applied by inserting or updating a row in `tenant_entitlement_overrides`:

```sql
INSERT INTO tenant_entitlement_overrides
  (tenant_id, capability_key, integer_value, reason)
VALUES
  ($1, 'extension.max_count', $2, 'extension-pack-x1')
ON CONFLICT (tenant_id, capability_key)
DO UPDATE SET integer_value = EXCLUDED.integer_value, reason = EXCLUDED.reason;
```

The override takes precedence over the base plan limit in `EntitlementService`.

## Expiring Packs

For time-limited packs, set `expires_at` in the override row. The repository
filters out expired overrides automatically. When the override expires, the
tenant falls back to the base plan limit.
