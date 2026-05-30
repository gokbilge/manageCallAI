# 2026-05-29 SLICE-41 P1 Hardening Audit

## Scope

SLICE-41 implementation covering telecom/runtime, IVR builder/runtime, AI/MCP,
automation/n8n, and operations hardening.

## Depends on

- SLICE-40: outbound destination safety, queue runtime policy (already implemented).
- SLICE-38: MCP contract alignment, IVR_NODE_TYPES in contracts.
- SLICE-39: CI safety gates.

---

## Implemented items

### Telecom / Runtime

**DTMF mode and codec policy (Migration 0034)**
- `sip_trunks.dtmf_mode` added: `rfc2833` (default) | `info` | `inband` | `auto`.
- `sip_trunks.codec_prefs` added: optional ordered codec list.
- `SipTrunk` type, repository, service, and controller updated.
- Gateway XML builder can now include dtmf_mode and codec_prefs in FreeSWITCH
  gateway configuration.

**Registration event log (Migration 0033)**
- New `extension_event_log` table: `registered`, `expired`, `unregistered`, `auth_failed`
  events per extension, with idempotency on `freeswitch_event_id`.
- `POST /api/v1/runtime/extension-events` — runtime-token authenticated ingest from
  the FreeSWITCH Go adapter.
- `GET /api/v1/extensions/:extensionNumber/events` — operator query endpoint.
- Mirrors registration events into `extension_registrations` for the live HUD.

**Call recording storage lifecycle (Migration 0035)**
- `call_recordings.retain_until`, `archived_at`, `archive_path`, `deleted_at`,
  `delete_reason` added.
- Partial index for purge eligibility.

**Voicemail message storage and retrieval (Migration 0036)**
- New `voicemail_messages` table.
- `POST /api/v1/voicemail-boxes/:boxId/messages` — runtime ingest.
- `GET /api/v1/voicemail-boxes/:boxId/messages` — list (with `unread_only` filter).
- `POST /api/v1/voicemail-boxes/messages/:id/read` — mark as read.
- `DELETE /api/v1/voicemail-boxes/messages/:id` — soft delete.

### IVR Builder / Runtime

**IVR graph hardening (ivr-flow.validation.ts)**
- Loop detection: traversal exceeding `MAX_TRAVERSAL_DEPTH=50` nodes raises an error.
- Fallback node support: `fallback_node_id` field accepted on any node type; reference
  validity checked in the traversal phase.
- Max retry policy: `max_retries` integer field validated as non-negative integer.
- Prompt playback warning: `play_prompt` and `play_collect` nodes without `prompt_id`
  or `prompt_uri` emit a warning that callers will hear silence.
- `computeReachableBranches()` exported for simulation coverage report.

**Graph diff endpoint**
- `GET /api/v1/ivr-flows/:id/diff` — compares draft vs active version node-by-node.
  Returns `{ added, removed, modified, unchanged }` with per-node detail.

**Simulation coverage endpoint**
- `GET /api/v1/ivr-flows/:id/simulation-coverage` — reports which draft nodes have
  been visited in at least one simulation run.
  Returns `{ coverage_pct, tested_count, total_count, nodes: {id: "tested"|"untested"} }`.

### AI / MCP

**Capability-limited API keys (Migration 0029)**
- `automation_api_keys.capabilities text[]` added.
- Default `['*']` for existing keys (equivalent to tenant_admin capability set).
- New keys can specify explicit capability lists (e.g. `['tenant.ivr_flows.view']`).
- `AuthClaims.capabilities` field added.
- `requireCapability` checks `capabilities` array when present, bypassing role-based lookup.
- Controller passes `req.body.capabilities` to service.
- Tests cover scoped key grant/deny and wildcard expansion.

**MCP access_token anti-pattern removed**
- `apps/mcp-server/src/server.ts`: all tool inputSchemas no longer require `access_token`.
- `apps/mcp-server/src/api/client.ts`: uses `MANAGECALL_API_KEY` env var. Startup
  fails with a clear error if the key is missing.
- Full deprecation notice added to server and client.
- `apps/mcp-server` version bumped to `0.2.0`.
- Node descriptions updated to document `fallback_node_id` and `max_retries`.

**Tool risk classification**
- `apps/mcp/src/tools/risk.ts` — `ToolRisk` type and `TOOL_RISK_MAP` classifying every
  MCP tool as `read | low | medium | high`. Documentation explains the canary pattern.

**Structured logging (apps/api)**
- `apps/api/src/logging/logger.ts` — `registerLoggingHooks` binds `request_id` on
  every request; binds `tenant_id` from JWT claims in preHandler; binds `call_id` when
  present in body/params/query.

### Automation / n8n

**Idempotency keys (Migration 0032)**
- New `idempotency_records` table (tenant-scoped, 24h TTL).
- `idempotency.plugin.ts` — Fastify plugin: checks `Idempotency-Key` header before
  routing on POST/PATCH/PUT; caches 2xx responses; returns cached result with
  `Idempotency-Replayed: true`.
- Applied globally to all mutation routes via `buildApp()`.

**Webhook event IDs (Migration 0031)**
- `webhook_delivery_queue.event_id uuid` — one UUID per business event, shared across
  all webhook deliveries for that event (de-duplication for consumers).
- Unique index prevents duplicate enqueue per (webhook_id, event_id).
- `Webhook-Event-Id` header sent on every delivery attempt.

**Webhook dead-letter queue**
- `automation_api_keys.abandoned_at`, `dismissed_at`, `dismiss_reason` added.
- `GET /api/v1/automation/webhook-delivery/abandoned` — list abandoned items.
- `POST /api/v1/automation/webhook-delivery/:id/retry` — requeue abandoned item.
- `POST /api/v1/automation/webhook-delivery/:id/dismiss` — dismiss with optional reason.
- Repository methods: `listAbandonedDeliveries`, `retryAbandonedDelivery`,
  `dismissAbandonedDelivery`.

**Business event catalog (packages/contracts)**
- `WEBHOOK_EVENTS` expanded: `call.started`, `outbound_call.completed`,
  `outbound_call.failed`, `extension.registered`, `extension.expired`,
  `recording.analysis_completed`, `recording.analysis_failed`.
- `WEBHOOK_EVENT_DESCRIPTIONS` map: human-readable description per event.
- `automation.types.ts` in API synced to match.

**n8n workflow examples**
- `docs/automation/n8n-workflow-examples.md` — missed call, voicemail → transcribe,
  publish failed, rollback announced, recording indexed. Includes signature verification
  and event_id de-duplication patterns.

### Operations

**Health checks per subsystem**
- `GET /health` expanded: db (latency), webhook_queue (pending count + degraded threshold),
  freeswitch_agent (last heartbeat age + ESL connection status).
- `GET /health/live` — liveness probe (always 200 if process is alive).
- `GET /health/ready` — readiness probe (checks DB).

**Prometheus metrics endpoint**
- `GET /metrics` — text/plain Prometheus format.
  Gauges: IVR sessions by status, webhook queue depth by status, recording analysis
  backlog, outbound call statuses, active tenant count.

**Support bundle export**
- `GET /api/v1/support/bundle` — requires `tenant.audit_log.view`.
  Returns: recent errors, recent call timeline, active IVR sessions, webhook queue
  summary, FreeSWITCH agent heartbeat, version info. No secrets exposed.

**Production deployment guide**
- `docs/ops/production-deployment.md` — environment variables, admin bootstrap, DB
  migration, TLS/SRTP strategy, NAT guidance, DTMF/codec configuration, backup/restore,
  upgrade playbook, SLOs for runtime lookup endpoints.

---

## Test summary

| Suite | Files | Tests | Result |
|---|---|---|---|
| API unit + integration | 38 | 368 | ✓ pass |
| MCP (incl. contract drift) | 5 | 37 | ✓ pass |
| Go (freeswitch-agent) | 6 pkgs | — | ✓ pass |
| Secret scan | 505 files | — | ✓ pass |
| Build (all packages) | 11 | — | ✓ pass |
| Lint | all | — | ✓ pass |
| `git diff --check` | — | — | ✓ clean |

## Migrations applied

| File | Change |
|---|---|
| `0029_api_key_capabilities.sql` | `capabilities text[]` on `automation_api_keys` |
| `0031_webhook_event_ids_and_dlq.sql` | `event_id`, `abandoned_at`, `dismissed_at` on delivery queue |
| `0032_idempotency_records.sql` | New `idempotency_records` table |
| `0033_extension_event_log.sql` | New `extension_event_log` table |
| `0034_dtmf_and_codec.sql` | `dtmf_mode`, `codec_prefs` on `sip_trunks` |
| `0035_recording_lifecycle.sql` | Retention and archival fields on `call_recordings` |
| `0036_voicemail_messages.sql` | New `voicemail_messages` table |

## Remaining open items from SLICE-41

1. **Visual IVR builder** — frontend work not yet started; API surface is complete.
2. **Localization / multilingual prompt sets** — schema extension needed (prompt language tags,
   multi-language flow definitions).
3. **Live session debugger** — requires SSE streaming (Observability HUD SLICE-35+).
4. **Rollback smoke test vs FreeSWITCH** — needs a self-hosted runner with FreeSWITCH.
5. **Dry-run mode for AI mutations** — `dry_run=true` query param on publish endpoints;
   deferred to SLICE-42.
6. **MCP AI actor in audit** — audit events should record `actor_type = 'ai_agent'` when
   called via API key; deferred to SLICE-42.
7. **Tracing across API → adapter → callback** — requires OpenTelemetry instrumentation;
   deferred to SLICE-42.
8. **FreeSWITCH SRTP policy** — per-trunk SRTP field planned; currently configured
   at the FreeSWITCH profile level.
