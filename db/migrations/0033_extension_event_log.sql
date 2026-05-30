-- Extension event log: first-class timeline events for SIP registration
-- lifecycle. Written by the FreeSWITCH adapter when SOFIA REGISTER / EXPIRE
-- / UNREGISTER events arrive.

CREATE TABLE IF NOT EXISTS extension_event_log (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension_id     uuid REFERENCES extensions(id) ON DELETE SET NULL,
    extension_number text NOT NULL,
    event_type       text NOT NULL CHECK (event_type IN (
                         'registered', 'expired', 'unregistered', 'auth_failed'
                     )),
    contact_domain   text,
    user_agent       text,
    source_ip        text,
    -- Freeswitch-internal UUID for the registration event; used for idempotency.
    freeswitch_event_id text,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extension_event_log_tenant_ext
    ON extension_event_log (tenant_id, extension_number, created_at DESC);

CREATE INDEX IF NOT EXISTS extension_event_log_tenant_type
    ON extension_event_log (tenant_id, event_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS extension_event_log_freeswitch_idempotency
    ON extension_event_log (tenant_id, freeswitch_event_id)
    WHERE freeswitch_event_id IS NOT NULL;
