# ADR-0010: RPC Error Standard for API Responses

**Status:** Accepted

## Context

Prior to this decision every controller and auth middleware produced ad-hoc error
responses: `{ "error": "Not found" }`, `{ "error": "Unauthorized" }`, etc. These
strings are:

- Not machine-parseable without fragile string matching
- Inconsistent across modules (different capitalisation, wording)
- Missing correlation IDs so support cannot join client errors with server logs
- Not aligned with any industry standard, making SDK generation harder

The project already uses gRPC-inspired terminology in internal discussions. Fastify
provides a global `setErrorHandler` hook and request IDs out of the box.

## Decision

Adopt a uniform error response envelope with a machine-readable `error` code drawn
from a fixed enum inspired by gRPC status codes, a human-readable `message` field,
and a `request_id` echoed from the `X-Request-ID` response header.

```json
{ "error": "NOT_FOUND", "message": "Extension not found: ext_abc", "request_id": "req-..." }
```

The mapping from HTTP status to code is stable (see `docs/design/error-handling-and-logging.md`).
No new HTTP status codes are added beyond the eight defined in the standard.

A single global error handler (`apps/api/src/errors/error-handler.ts`) registered
on the Fastify instance intercepts:

- Fastify schema-validation errors → `INVALID_ARGUMENT` (400)
- `FST_ERR_*` Fastify internal errors → mapped by code
- All domain `*NotFoundError` classes → `NOT_FOUND` (404)
- Unhandled errors → `INTERNAL` (500), logged with stack trace

Helper functions in `apps/api/src/errors/error-reply.ts` are the only sanctioned
way to send error responses from middleware and controllers.

The `scripts/check-openapi-coverage.mjs` script enforces alignment between the
live code standard and the OpenAPI contract on every CI build.

## Consequences

**Positive:**

- Clients have a stable, machine-readable error code they can switch on.
- All errors carry `request_id` → logs and errors are always joinable.
- A single test file covers the global error handler; controllers only test business logic.
- OpenAPI spec is verified mechanically; drift is caught in CI, not at runtime.

**Negative:**

- All existing controllers and middleware must be updated to use the new helpers
  (one-time migration cost, ~30 files).
- Clients built against the old `{ "error": "..." }` string shape will break
  (acceptable: no external clients exist at this stage).

## Alternatives Considered

- **RFC 9457 `application/problem+json`**: richer but adds `type` URI and
  `title`/`status` fields that duplicate the HTTP status line; unnecessary
  complexity for an internal control-plane API.
- **Per-controller error handling**: already tried implicitly; produces the
  inconsistency this ADR fixes.
