import type { Pool } from 'pg';

export interface RouteMatch {
  route_id: string;
  tenant_id: string;
  match_type: string;
  match_value: string;
  target_type: 'extension' | 'flow' | 'call_group' | 'queue' | 'voicemail_box';
  target_id: string | null;
}

export interface ExtensionTarget {
  extension_number: string;
  sip_username: string;
  display_name: string;
  directory_domain: string | null;
}

export interface FlowTarget {
  name: string;
  definition: Record<string, unknown> | null;
}

export interface CallGroupMemberEntry {
  extension_number: string;
  directory_domain: string;
  position: number;
}

export interface CallGroupTarget {
  strategy: 'simultaneous' | 'sequential';
  members: CallGroupMemberEntry[];
}

export interface QueueTarget {
  strategy: 'simultaneous' | 'sequential';
  ring_timeout_seconds: number;
  retry_delay_seconds: number;
  max_wait_seconds: number;
  music_on_hold: string | null;
  overflow_target_type: 'extension' | 'call_group' | 'queue' | 'voicemail_box' | 'flow' | null;
  overflow_target_id: string | null;
  members: CallGroupMemberEntry[];
}

export interface VoicemailTarget {
  mailbox_number: string;
  directory_domain: string | null;
  greeting_prompt_uri: string | null;
}

export class RouteLookupRepository {
  constructor(private readonly db: Pool) {}

  async findRouteForCall(did: string, trunkName?: string): Promise<RouteMatch | null> {
    const r = await this.db.query<RouteMatch>(
      `SELECT
         ir.id AS route_id,
         ir.tenant_id,
         ir.match_type,
         ir.match_value,
         ir.target_type,
         ir.target_id
       FROM inbound_routes ir
       LEFT JOIN phone_numbers pn ON pn.id = ir.phone_number_id
       WHERE ir.status = 'active'
         AND (
           (ir.match_type = 'did' AND ir.phone_number_id IS NOT NULL AND pn.e164_number = $1)
           OR (ir.match_type = 'did' AND ir.phone_number_id IS NULL AND ir.match_value = $1)
           OR (ir.match_type = 'trunk' AND $2::text IS NOT NULL AND ir.match_value = $2)
           OR (ir.match_type = 'pattern' AND $1 ~ ir.match_value)
         )
       ORDER BY
         CASE
           WHEN ir.match_type = 'did' AND ir.phone_number_id IS NOT NULL THEN 0
           WHEN ir.match_type = 'did' THEN 1
           WHEN ir.match_type = 'trunk' THEN 2
           WHEN ir.match_type = 'pattern' THEN 3
           ELSE 4
         END
       LIMIT 1`,
      [did, trunkName ?? null],
    );
    return r.rows[0] ?? null;
  }

  async findExtensionTarget(extensionId: string): Promise<ExtensionTarget | null> {
    const r = await this.db.query<ExtensionTarget>(
      `SELECT e.extension_number, e.sip_username, e.display_name, t.directory_domain
       FROM extensions e
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.id = $1 AND e.status = 'active'`,
      [extensionId],
    );
    return r.rows[0] ?? null;
  }

  async findFlowTarget(flowId: string): Promise<FlowTarget | null> {
    const r = await this.db.query<FlowTarget>(
      `SELECT f.name, fv.definition
       FROM ivr_flows f
       LEFT JOIN flow_versions fv ON fv.id = f.active_version_id
       WHERE f.id = $1 AND f.status = 'active'`,
      [flowId],
    );
    return r.rows[0] ?? null;
  }

  async findCallGroupTarget(groupId: string): Promise<CallGroupTarget | null> {
    const groupR = await this.db.query<{ strategy: string }>(
      `SELECT strategy FROM call_groups WHERE id = $1 AND status = 'active'`,
      [groupId],
    );
    if (!groupR.rows[0]) return null;

    const membersR = await this.db.query<CallGroupMemberEntry>(
      `SELECT e.extension_number, t.directory_domain, cgm.position
       FROM call_group_members cgm
       JOIN extensions e ON e.id = cgm.extension_id
       JOIN tenants t ON t.id = cgm.tenant_id
       WHERE cgm.call_group_id = $1 AND e.status = 'active'
       ORDER BY cgm.position ASC, e.extension_number ASC`,
      [groupId],
    );
    if (membersR.rows.length === 0) return null;

    return {
      strategy: groupR.rows[0].strategy as 'simultaneous' | 'sequential',
      members: membersR.rows,
    };
  }

  async findQueueTarget(queueId: string): Promise<QueueTarget | null> {
    const queueR = await this.db.query<{
      strategy: string;
      ring_timeout_seconds: number;
      retry_delay_seconds: number;
      max_wait_seconds: number;
      music_on_hold: string | null;
      overflow_target_type: 'extension' | 'call_group' | 'queue' | 'voicemail_box' | 'flow' | null;
      overflow_target_id: string | null;
    }>(
      `SELECT strategy, ring_timeout_seconds, retry_delay_seconds, max_wait_seconds,
              music_on_hold, overflow_target_type, overflow_target_id
       FROM queues WHERE id = $1 AND status = 'active'`,
      [queueId],
    );
    if (!queueR.rows[0]) return null;

    const membersR = await this.db.query<CallGroupMemberEntry>(
      `SELECT e.extension_number, t.directory_domain, qm.position
       FROM queue_members qm
       JOIN extensions e ON e.id = qm.extension_id
       JOIN tenants t ON t.id = qm.tenant_id
       WHERE qm.queue_id = $1 AND e.status = 'active'
       ORDER BY qm.position ASC, e.extension_number ASC`,
      [queueId],
    );
    if (membersR.rows.length === 0) return null;

    return {
      strategy: queueR.rows[0].strategy as 'simultaneous' | 'sequential',
      ring_timeout_seconds: queueR.rows[0].ring_timeout_seconds,
      retry_delay_seconds: queueR.rows[0].retry_delay_seconds,
      max_wait_seconds: queueR.rows[0].max_wait_seconds,
      music_on_hold: queueR.rows[0].music_on_hold,
      overflow_target_type: queueR.rows[0].overflow_target_type,
      overflow_target_id: queueR.rows[0].overflow_target_id,
      members: membersR.rows,
    };
  }

  async findVoicemailTarget(boxId: string): Promise<VoicemailTarget | null> {
    const r = await this.db.query<VoicemailTarget>(
      `SELECT vb.mailbox_number, t.directory_domain, pa.storage_uri AS greeting_prompt_uri
       FROM voicemail_boxes vb
       JOIN tenants t ON t.id = vb.tenant_id
       LEFT JOIN prompt_assets pa ON pa.id = vb.greeting_prompt_id
       WHERE vb.id = $1 AND vb.status = 'active'`,
      [boxId],
    );
    return r.rows[0] ?? null;
  }

  async findTenantByDomain(domain: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM tenants WHERE LOWER(directory_domain) = LOWER($1) AND status = 'active' LIMIT 1`,
      [domain],
    );
    return r.rows[0] ?? null;
  }

  async findRouteForDialplan(tenantId: string, destinationNumber: string): Promise<RouteMatch | null> {
    const r = await this.db.query<RouteMatch>(
      `SELECT ir.id AS route_id, ir.tenant_id, ir.match_type, ir.match_value, ir.target_type, ir.target_id
       FROM inbound_routes ir
       LEFT JOIN phone_numbers pn ON pn.id = ir.phone_number_id
       WHERE ir.status = 'active'
         AND ir.tenant_id = $1
         AND ir.match_type = 'did'
         AND (
           (ir.phone_number_id IS NOT NULL AND pn.e164_number = $2)
           OR (ir.phone_number_id IS NULL AND ir.match_value = $2)
         )
       ORDER BY
         CASE
           WHEN ir.phone_number_id IS NOT NULL THEN 0
           ELSE 1
         END
       LIMIT 1`,
      [tenantId, destinationNumber],
    );
    return r.rows[0] ?? null;
  }
}
