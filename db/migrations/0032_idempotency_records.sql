-- Idempotency records for AI mutations.
--
-- Stores the result of a write operation keyed by (tenant_id, idempotency_key).
-- When the same key is replayed within the TTL window, the API returns the
-- cached response without re-executing the mutation.
-- TTL: 24 hours. Background job in apps/worker purges expired rows.

CREATE TABLE IF NOT EXISTS idempotency_records (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    status_code     integer NOT NULL,
    response_body   jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL DEFAULT now() + interval '24 hours',
    UNIQUE (tenant_id, idempotency_key)
);

-- Plain index on expires_at. The purge query WHERE expires_at < NOW() uses this.
-- Partial predicates with now() are not allowed (non-immutable).
CREATE INDEX IF NOT EXISTS idempotency_records_expiry_idx
    ON idempotency_records (expires_at ASC);
