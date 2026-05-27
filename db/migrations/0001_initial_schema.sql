CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    directory_domain text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (directory_domain)
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email text NOT NULL,
    display_name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    policy_type text NOT NULL,
    rules jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE role_policies (
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, policy_id)
);

CREATE TABLE extensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension_number text NOT NULL,
    display_name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    sip_username text NOT NULL,
    sip_password_ciphertext text NOT NULL,
    sip_password_key_id text NOT NULL,
    default_destination_type text CHECK (default_destination_type IN ('flow', 'extension', 'user', 'queue')),
    default_destination_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, extension_number),
    UNIQUE (tenant_id, sip_username)
);

CREATE TABLE sip_trunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    realm text NOT NULL,
    proxy text NOT NULL,
    port integer NOT NULL DEFAULT 5060,
    transport text NOT NULL DEFAULT 'udp' CHECK (transport IN ('udp', 'tcp', 'tls')),
    username text,
    auth_username text NOT NULL,
    auth_password_ciphertext text NOT NULL,
    auth_password_key_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE prompt_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    media_type text NOT NULL,
    language text,
    storage_uri text,
    checksum text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE ivr_flows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
    draft_version_id uuid,
    active_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE inbound_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    match_type text NOT NULL CHECK (match_type IN ('did', 'trunk', 'pattern')),
    match_value text NOT NULL,
    phone_number_id uuid,
    target_type text NOT NULL CHECK (target_type IN ('flow', 'extension')),
    target_id uuid,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
    draft_version_id uuid,
    active_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name),
    UNIQUE (tenant_id, match_type, match_value)
);

CREATE TABLE outbound_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    match_strategy text,
    destination_pattern text NOT NULL,
    trunk_selection_strategy text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
    draft_version_id uuid,
    active_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE phone_numbers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    e164_number text NOT NULL,
    display_label text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    assigned_target_type text CHECK (assigned_target_type IN ('inbound_route', 'flow', 'extension')),
    assigned_target_id uuid,
    trunk_id uuid REFERENCES sip_trunks(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, e164_number)
);

CREATE TABLE flow_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flow_id uuid NOT NULL REFERENCES ivr_flows(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    state text NOT NULL CHECK (state IN ('draft', 'validated', 'simulated', 'published', 'superseded', 'rolled_back')),
    definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    validated_at timestamptz,
    simulated_at timestamptz,
    published_at timestamptz,
    UNIQUE (flow_id, version_number)
);

CREATE TABLE route_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    route_type text NOT NULL CHECK (route_type IN ('inbound', 'outbound')),
    route_id uuid NOT NULL,
    version_number integer NOT NULL,
    state text NOT NULL CHECK (state IN ('draft', 'validated', 'simulated', 'published', 'superseded', 'rolled_back')),
    definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    validated_at timestamptz,
    simulated_at timestamptz,
    published_at timestamptz,
    UNIQUE (route_type, route_id, version_number)
);

ALTER TABLE ivr_flows
    ADD CONSTRAINT ivr_flows_draft_version_fk
    FOREIGN KEY (draft_version_id) REFERENCES flow_versions(id) ON DELETE SET NULL;

ALTER TABLE ivr_flows
    ADD CONSTRAINT ivr_flows_active_version_fk
    FOREIGN KEY (active_version_id) REFERENCES flow_versions(id) ON DELETE SET NULL;

ALTER TABLE inbound_routes
    ADD CONSTRAINT inbound_routes_draft_version_fk
    FOREIGN KEY (draft_version_id) REFERENCES route_versions(id) ON DELETE SET NULL;

ALTER TABLE inbound_routes
    ADD CONSTRAINT inbound_routes_active_version_fk
    FOREIGN KEY (active_version_id) REFERENCES route_versions(id) ON DELETE SET NULL;

ALTER TABLE inbound_routes
    ADD CONSTRAINT inbound_routes_phone_number_fk
    FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(id) ON DELETE SET NULL;

ALTER TABLE outbound_routes
    ADD CONSTRAINT outbound_routes_draft_version_fk
    FOREIGN KEY (draft_version_id) REFERENCES route_versions(id) ON DELETE SET NULL;

ALTER TABLE outbound_routes
    ADD CONSTRAINT outbound_routes_active_version_fk
    FOREIGN KEY (active_version_id) REFERENCES route_versions(id) ON DELETE SET NULL;

CREATE TABLE validation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    version_id uuid,
    validator_version text,
    status text NOT NULL CHECK (status IN ('passed', 'failed', 'warning_only')),
    errors jsonb NOT NULL DEFAULT '[]'::jsonb,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE simulation_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    version_id uuid,
    scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL CHECK (status IN ('passed', 'failed', 'inconclusive')),
    result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ivr_flow_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flow_id uuid NOT NULL REFERENCES ivr_flows(id) ON DELETE CASCADE,
    flow_version_id uuid NOT NULL REFERENCES flow_versions(id) ON DELETE RESTRICT,
    call_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    current_node_id text,
    caller_number text,
    destination_number text,
    last_digits text,
    variables_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_action_json jsonb,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, call_id)
);

CREATE TABLE approval_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    version_id uuid,
    requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    decision_by uuid REFERENCES users(id) ON DELETE SET NULL,
    decision_at timestamptz,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE publish_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    version_id uuid,
    action_type text NOT NULL CHECK (action_type IN ('publish', 'rollback')),
    triggered_by_type text NOT NULL CHECK (triggered_by_type IN ('user', 'workflow', 'ai_agent', 'system')),
    triggered_by_id text,
    approval_request_id uuid REFERENCES approval_requests(id) ON DELETE SET NULL,
    result text NOT NULL CHECK (result IN ('success', 'failed', 'pending_approval')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_type text NOT NULL CHECK (actor_type IN ('user', 'workflow', 'ai_agent', 'system')),
    actor_id text,
    action text NOT NULL,
    object_type text NOT NULL,
    object_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE call_detail_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number text,
    to_number text,
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    duration_seconds integer,
    termination_reason text,
    final_disposition text,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE call_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id text NOT NULL,
    event_type text NOT NULL,
    event_time timestamptz NOT NULL,
    source text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runtime_ingestion_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
    source_type text NOT NULL,
    source_reference text,
    status text NOT NULL CHECK (status IN ('received', 'processed', 'failed')),
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    error_message text
);

CREATE INDEX idx_users_tenant_id ON users (tenant_id);
CREATE INDEX idx_roles_tenant_id ON roles (tenant_id);
CREATE INDEX idx_policies_tenant_id ON policies (tenant_id);
CREATE INDEX idx_extensions_tenant_id ON extensions (tenant_id);
CREATE INDEX idx_sip_trunks_tenant_id ON sip_trunks (tenant_id);
CREATE INDEX idx_prompt_assets_tenant_id ON prompt_assets (tenant_id);
CREATE INDEX idx_phone_numbers_tenant_id ON phone_numbers (tenant_id);
CREATE INDEX idx_phone_numbers_trunk_id ON phone_numbers (trunk_id);
CREATE INDEX idx_ivr_flows_tenant_id ON ivr_flows (tenant_id);
CREATE INDEX idx_flow_versions_flow_id ON flow_versions (flow_id);
CREATE INDEX idx_inbound_routes_tenant_id ON inbound_routes (tenant_id);
CREATE INDEX idx_inbound_routes_phone_number_id ON inbound_routes (phone_number_id);
CREATE INDEX idx_outbound_routes_tenant_id ON outbound_routes (tenant_id);
CREATE INDEX idx_route_versions_route_lookup ON route_versions (route_type, route_id);
CREATE INDEX idx_validation_results_lookup ON validation_results (tenant_id, object_type, object_id, created_at DESC);
CREATE INDEX idx_simulation_results_lookup ON simulation_results (tenant_id, object_type, object_id, created_at DESC);
CREATE INDEX idx_ivr_flow_sessions_call_id ON ivr_flow_sessions (tenant_id, call_id);
CREATE INDEX idx_ivr_flow_sessions_status ON ivr_flow_sessions (tenant_id, status, created_at DESC);
CREATE INDEX idx_approval_requests_lookup ON approval_requests (tenant_id, object_type, object_id, status);
CREATE INDEX idx_publish_records_lookup ON publish_records (tenant_id, object_type, object_id, created_at DESC);
CREATE INDEX idx_audit_events_lookup ON audit_events (tenant_id, object_type, object_id, created_at DESC);
CREATE INDEX idx_call_detail_records_call_id ON call_detail_records (tenant_id, call_id);
CREATE INDEX idx_call_detail_records_start_time ON call_detail_records (tenant_id, start_time DESC);
CREATE INDEX idx_call_events_call_id ON call_events (tenant_id, call_id);
CREATE INDEX idx_call_events_event_time ON call_events (tenant_id, event_time DESC);
CREATE INDEX idx_runtime_ingestion_records_status ON runtime_ingestion_records (status, received_at DESC);
