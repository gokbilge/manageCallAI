# Edition Capability Matrix

All limits enforced by `EntitlementService.assertWithinLimit()`. Enterprise
values are contract-defined unless an explicit integer override exists in
`tenant_entitlement_overrides`.

| Capability Key | Free | Pro | Enterprise |
|----------------|------|-----|-----------|
| `tenant.max_count` | 1 | 3 | Contract-defined |
| `user.admin.max_count` | 2 | 10 | Contract-defined |
| `user.end_user.max_count` | 10 | 100 | Contract-defined |
| `extension.max_count` | 25 | 250 | Contract-defined |
| `device.max_count` | 25 | 300 | Contract-defined |
| `sip_trunk.max_count` | 2 | 10 | Contract-defined |
| `did.max_count` | 10 | 250 | Contract-defined |
| `route.inbound.max_count` | 10 | 250 | Contract-defined |
| `route.outbound.max_count` | 5 | 100 | Contract-defined |
| `ivr.flow.max_count` | 5 | 50 | Contract-defined |
| `ivr.version.max_per_flow` | 5 | 25 | Contract-defined |
| `queue.max_count` | 2 | 25 | Contract-defined |
| `ring_group.max_count` | 5 | 50 | Contract-defined |
| `voicemail_box.max_count` | 25 | 250 | Contract-defined |
| `conference_room.max_count` | 1 | 25 | Contract-defined |
| `parking_lot.max_count` | 1 | 10 | Contract-defined |
| `schedule.max_count` | 5 | 100 | Contract-defined |
| `holiday_calendar.max_count` | 1 | 25 | Contract-defined |
| `feature_code.max_count` | 10 | 100 | Contract-defined |
| `api_key.max_count` | 1 | 25 | Contract-defined |
| `webhook.max_count` | 1 | 25 | Contract-defined |
| `n8n.connection.max_count` | 1 | 10 | Contract-defined |
| `call_events.monthly_limit` | 5,000 / month | 500,000 / month | Contract-defined |
| `call_events.retention_days` | 14 days | 90 days | Contract-defined |
| `audit.retention_days` | 30 days | 365 days | Contract-defined |
| `recording.storage_mb` | 500 MB | 51,200 MB (50 GB) | Contract-defined |
| `recording.retention_days` | 7 days | 30 days | Contract-defined |
| `voicemail.storage_mb` | 250 MB | 10,240 MB (10 GB) | Contract-defined |
| `transcript.storage_mb` | 50 MB | 2,048 MB (2 GB) | Contract-defined |
| `ai.failure_explanation.monthly_limit` | 25 / month | 2,500 / month | Contract-defined |
| `ai.route_risk.monthly_limit` | 10 / month | 1,000 / month | Contract-defined |
| `ai.summary.monthly_limit` | 10 / month | 2,500 / month | Contract-defined |
| `ai.nl_report.monthly_limit` | 10 / month | 1,000 / month | Contract-defined |
| `migration.analysis.monthly_limit` | 1 / month | 5 / month | Contract-defined |
| `migration.draft_import.monthly_limit` | 0 / month | 5 / month | Contract-defined |

## Notes

- `integer_value=0` means the feature is disabled (e.g., `migration.draft_import.monthly_limit` on Free).
- `string_value='contract'` with `integer_value=NULL` means non-blocking unless a `tenant_entitlement_overrides` row sets an explicit integer.
- Units: `count` = object count at rest, `monthly` = rolling calendar-month counter, `days` = retention window, `mb` = storage cap.
