# Testing Critical Paths

This matrix defines release-grade test expectations for telecom control-plane behavior.

| Area | Required confidence | Preferred test type |
| --- | --- | --- |
| Auth/RBAC | Roles and API keys fail closed, platform capabilities do not leak to tenants, runtime identity cannot use normal CRUD. | Fastify integration and web route guard tests |
| Tenant isolation | Cross-tenant list/get/update/delete/action attempts never leak data and never mutate the source tenant. | Reusable API integration harness |
| IVR lifecycle | Draft, validate, simulate, approval, publish, supersede, rollback, and runtime resolver behavior are atomic and auditable. | API integration and API-only E2E |
| Runtime auth/XML | Bearer/basic/header runtime auth works, query/body fallback is denied in production, XML escaping prevents injection. | API integration and golden XML tests |
| Outbound fraud safety | Destination policies, trunk activity, idempotency, audit, and rate limits protect outbound call creation. | API service and integration tests |
| Webhooks/idempotency | Signatures, timestamp tolerance, replay protection, retry, DLQ, and cached idempotency responses are deterministic. | API integration and contract tests |
| MCP safety | Tools are narrower than REST, schemas do not accept tokens, mutations follow draft/validate/simulate/request-publish lifecycle. | MCP registry and handler tests |
| SDK trust | Generated client paths, auth headers, stable errors, query params, and representative endpoint calls work predictably. | Custom fetch unit tests |
| Go ESL event delivery | Event parsing, normalization, tenant/call correlation, API delivery, malformed events, and logging levels are deterministic. | Go unit tests and `httptest` |
| Observability | Summary, active calls, sessions, queues, health, alerts, timeline ordering, and empty states are tenant-scoped. | API integration and React behavior tests |
| E2E demo loop | Register tenant, configure routing, publish IVR, resolve runtime, ingest event, query observability, rollback. | API-only E2E in normal CI |

Critical-path tests must not bypass the same safety boundary they claim to validate. Unit tests may mock persistence or HTTP clients, but integration and E2E tests should exercise real request parsing, auth gates, tenant scoping, service rules, and response contracts.
