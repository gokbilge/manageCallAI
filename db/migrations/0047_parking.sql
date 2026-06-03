-- SLICE-62: Call parking lots and parked call tracking
--
-- Operators configure parking lots with slot ranges. FreeSWITCH valet_park
-- parks calls into slots. The Go agent listens for CHANNEL_PARK/CHANNEL_UNPARK
-- events and calls back to the API runtime endpoints to maintain state.

CREATE TABLE IF NOT EXISTS parking_lots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                text NOT NULL,
    slot_range_start    int NOT NULL DEFAULT 801,
    slot_range_end      int NOT NULL DEFAULT 820,
    timeout_seconds     int NOT NULL DEFAULT 300,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name),
    CONSTRAINT chk_slot_range
        CHECK (slot_range_start > 0
           AND slot_range_end <= 9999
           AND slot_range_start < slot_range_end)
);

CREATE TABLE IF NOT EXISTS parked_calls (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parking_lot_id  uuid NOT NULL REFERENCES parking_lots(id) ON DELETE CASCADE,
    slot            int NOT NULL,
    call_id         text NOT NULL,
    parked_by       text,              -- extension number if known
    status          text NOT NULL DEFAULT 'parked'
                    CHECK (status IN ('parked', 'retrieved', 'timed_out')),
    parked_at       timestamptz NOT NULL DEFAULT now(),
    timeout_at      timestamptz,
    retrieved_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one active parked call per slot per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parked_calls_active_slot
    ON parked_calls (tenant_id, slot)
    WHERE status = 'parked';

CREATE INDEX IF NOT EXISTS idx_parked_calls_lot
    ON parked_calls (parking_lot_id, status);

CREATE INDEX IF NOT EXISTS idx_parking_lots_tenant
    ON parking_lots (tenant_id);

COMMENT ON TABLE parking_lots IS
    'Tenant-defined call parking lots with slot ranges. '
    'FreeSWITCH valet_park uses slot numbers within the range.';

COMMENT ON TABLE parked_calls IS
    'Live and historical parked call records. '
    'Created by Go agent CHANNEL_PARK events; updated on retrieve/timeout.';
