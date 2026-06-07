# Private Schema Extension Policy

Last updated: 2026-06-07.

This document is the exhaustive allow/deny list governing which table definitions
may appear in public migrations and which must be kept in private commercial or
enterprise modules.

The check script `scripts/check-public-schema-boundary.mjs` enforces the deny
list automatically on every CI run.

---

## Allowed in public migrations

The following table categories may appear in `db/migrations/` in this repository:

| Category | Table name examples |
|----------|--------------------|
| Multi-tenant foundation | `tenants`, `users`, `tenant_users`, `roles` |
| Auth | `api_keys`, `api_key_capabilities`, `refresh_tokens` |
| Extensions | `extensions`, `extension_assignments` |
| Devices | `devices`, `device_registrations` |
| SIP trunks | `sip_trunks`, `sip_trunk_credentials` |
| Phone numbers / DIDs | `phone_numbers`, `did_pool` |
| Inbound / outbound routing | `inbound_routes`, `outbound_routes` |
| IVR lifecycle | `ivr_flows`, `ivr_flow_versions`, `ivr_approvals` |
| Call groups / ring groups | `call_groups`, `call_group_members` |
| Queues | `queues`, `queue_members`, `queue_callbacks` |
| Voicemail | `voicemail_boxes`, `voicemail_messages` |
| Conference / parking | `conference_rooms`, `parking_lots` |
| Schedules | `schedules`, `holiday_calendars` |
| Feature codes | `feature_codes` |
| Automation | `automation_api_keys`, `automation_webhooks` |
| Call events | `call_events`, `call_event_retention_policies` |
| Recordings | `recordings`, `transcripts` |
| Audit | `audit_log`, `audit_events` |
| FreeSWITCH integration | `freeswitch_registrations`, `freeswitch_events` |
| Entitlement foundation | `commercial_plans`, `commercial_plan_entitlements`, `tenant_subscriptions`, `tenant_entitlement_overrides`, `tenant_usage_counters`, `usage_events` |
| Public module registry | `registered_modules`, `module_capability_keys` |
| Agent workspace / skills | `agent_skills`, `skill_assignments`, `agent_availability` |
| Supervisor / QA | `supervisor_sessions`, `qa_scores`, `dispositions` |
| Campaign baseline | `campaigns`, `campaign_contacts` |
| CRM integrations (public schema) | `crm_integration_configs` |
| Carrier interop baseline | `carrier_profiles`, `carrier_test_results` |

---

## Not allowed in public migrations

The following table name prefixes and substrings are blocked from public migrations.
Adding any of these to a public migration file will fail CI.

### License and activation

- `license_activation`
- `license_revocation`
- `license_generator`
- `activation_nonce`
- `signing_key`

### Commercial agreements and billing

- `customer_contract`
- `invoice`
- `invoice_line`
- `subscription_billing`
- `billing_event`
- `reseller_billing`
- `reseller_account`
- `partner_margin`
- `paid_add_on`
- `add_on_purchase`
- `channel_partner`

### Identity federation

- `sso_connection`
- `saml_metadata`
- `saml_config`
- `oidc_client`
- `oidc_config`
- `identity_provider`
- `federated_identity`

### Enterprise migration intelligence

- `migration_project`
- `migration_job`
- `migration_batch`
- `cucm_import`
- `avaya_import`
- `alcatel_import`
- `cisco_uccx_import`
- `pbx_import`
- `compatibility_score`
- `migration_intelligence`

### Enterprise analytics and export

- `compliance_export`
- `legal_hold`
- `enterprise_audit_export`
- `retention_policy_export`
- `data_export_job`

### HA deployment and infrastructure

- `ha_node`
- `deployment_instance`
- `cluster_registry`
- `carrier_certification`
- `private_module`

### Support and SLA

- `support_contract`
- `support_ticket`
- `sla_tier`
- `escalation_record`

---

## Extension rules

Private commercial and enterprise modules may:

1. **Add new tables** in `managecallai_commercial` or `managecallai_enterprise`
   PostgreSQL schemas — never in `public`.

2. **Add extension columns** to public tables only via documented extension
   column prefixes (`ext_commercial_*`, `ext_enterprise_*`) and only with
   explicit maintainer sign-off recorded in `private-migration-contract.md`.

3. **Reference public table IDs** as foreign keys from private schema tables —
   e.g., `managecallai_commercial.license_activations.tenant_id REFERENCES
   public.tenants(id)`.

4. **Never drop or rename** existing public core columns without a public
   migration and a backwards-compatibility deprecation window.

---

## Enforcement

The script `scripts/check-public-schema-boundary.mjs` scans all SQL files in
`db/migrations/` for blocked patterns and exits non-zero if any are found.

Run manually:

```sh
pnpm check:schema-boundary
```

This check runs in CI as part of the build gate.
