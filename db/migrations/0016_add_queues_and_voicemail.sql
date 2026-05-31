-- Migration 0016a: Add queues, queue_members, and voicemail_boxes tables.
--
-- Companion shim: 0016_outbound_call_requests.sql is a noop kept only to
-- preserve schema_migrations history. The outbound-call-requests content it
-- originally contained was renumbered to 0022_outbound_call_requests.sql.

CREATE TABLE IF NOT EXISTS queues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    strategy text NOT NULL DEFAULT 'simultaneous'
        CHECK (strategy IN ('simultaneous', 'sequential')),
    ring_timeout_seconds integer NOT NULL DEFAULT 20,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_queues_tenant_id
    ON queues (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS queue_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id uuid NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension_id uuid NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (queue_id, extension_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_members_queue_id
    ON queue_members (queue_id, position);

CREATE TABLE IF NOT EXISTS voicemail_boxes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    mailbox_number text NOT NULL,
    greeting_prompt_id uuid REFERENCES prompt_assets(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name),
    UNIQUE (tenant_id, mailbox_number)
);

CREATE INDEX IF NOT EXISTS idx_voicemail_boxes_tenant_id
    ON voicemail_boxes (tenant_id, status, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'inbound_routes'
      AND constraint_name = 'inbound_routes_target_type_check'
  ) THEN
    ALTER TABLE inbound_routes DROP CONSTRAINT inbound_routes_target_type_check;
  END IF;
END $$;

ALTER TABLE inbound_routes
    ADD CONSTRAINT inbound_routes_target_type_check
    CHECK (target_type IN ('flow', 'extension', 'call_group', 'queue', 'voicemail_box'));
