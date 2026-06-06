import type { Pool } from 'pg';
import type {
  AiRecommendation,
  AiRecommendationTargetType,
  CreateRecommendationInput,
  InboundRouteRow,
  OutboundRouteRow,
  PhoneNumberRow,
  RecommendationDetail,
  TenantPolicyRow,
  AiRecommendationRiskLevel,
} from './ai-recommendations.types.js';

const columns = `id, tenant_id, target_type, target_id, intent, status,
  recommendation, risk_level, rationale, blast_radius,
  accepted_at, rejected_at, decided_by, metadata, created_at`;

export class AiRecommendationRepository {
  constructor(private readonly db: Pool) {}

  async create(tenantId: string, input: CreateRecommendationInput): Promise<AiRecommendation> {
    const result = await this.db.query<AiRecommendation>(
      `INSERT INTO ai_recommendations (tenant_id, target_type, target_id, intent, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${columns}`,
      [
        tenantId,
        input.target_type,
        input.target_id ?? null,
        input.intent,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0]!;
  }

  async update(
    id: string,
    tenantId: string,
    recommendation: RecommendationDetail,
    riskLevel: AiRecommendationRiskLevel,
    rationale: string,
    blastRadius: string,
  ): Promise<AiRecommendation | null> {
    const result = await this.db.query<AiRecommendation>(
      `UPDATE ai_recommendations
       SET recommendation = $3::jsonb, risk_level = $4, rationale = $5, blast_radius = $6
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${columns}`,
      [id, tenantId, JSON.stringify(recommendation), riskLevel, rationale, blastRadius],
    );
    return result.rows[0] ?? null;
  }

  async listByTenant(tenantId: string, targetType?: AiRecommendationTargetType): Promise<AiRecommendation[]> {
    if (targetType) {
      const result = await this.db.query<AiRecommendation>(
        `SELECT ${columns} FROM ai_recommendations
         WHERE tenant_id = $1 AND target_type = $2
         ORDER BY created_at DESC LIMIT 200`,
        [tenantId, targetType],
      );
      return result.rows;
    }
    const result = await this.db.query<AiRecommendation>(
      `SELECT ${columns} FROM ai_recommendations
       WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT 200`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<AiRecommendation | null> {
    const result = await this.db.query<AiRecommendation>(
      `SELECT ${columns} FROM ai_recommendations WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async accept(id: string, tenantId: string, decidedBy: string): Promise<AiRecommendation | null> {
    const result = await this.db.query<AiRecommendation>(
      `UPDATE ai_recommendations
       SET status = 'accepted', accepted_at = NOW(), decided_by = $3
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
       RETURNING ${columns}`,
      [id, tenantId, decidedBy],
    );
    return result.rows[0] ?? null;
  }

  async reject(id: string, tenantId: string, decidedBy: string): Promise<AiRecommendation | null> {
    const result = await this.db.query<AiRecommendation>(
      `UPDATE ai_recommendations
       SET status = 'rejected', rejected_at = NOW(), decided_by = $3
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
       RETURNING ${columns}`,
      [id, tenantId, decidedBy],
    );
    return result.rows[0] ?? null;
  }

  // ── Data lookup for recommendation generation ─────────────────────────────

  async findInboundRoute(id: string, tenantId: string): Promise<InboundRouteRow | null> {
    const result = await this.db.query<InboundRouteRow>(
      `SELECT id, name, status, match_type, match_value, phone_number_id,
              target_type, target_id, draft_version_id, active_version_id
       FROM inbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findOutboundRoute(id: string, tenantId: string): Promise<OutboundRouteRow | null> {
    const result = await this.db.query<OutboundRouteRow>(
      `SELECT id, name, status, match_prefix, priority, sip_trunk_id,
              fallback_sip_trunk_id, max_calls_per_minute
       FROM outbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findPhoneNumbersForRoute(routeId: string, tenantId: string): Promise<PhoneNumberRow[]> {
    const result = await this.db.query<PhoneNumberRow>(
      `SELECT id, e164_number AS number, status FROM phone_numbers
       WHERE assigned_target_id = $1 AND assigned_target_type = 'inbound_route' AND tenant_id = $2 LIMIT 50`,
      [routeId, tenantId],
    );
    return result.rows;
  }

  async findActiveInboundRoutes(tenantId: string): Promise<Array<{ id: string; name: string; status: string }>> {
    const result = await this.db.query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM inbound_routes
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY name LIMIT 100`,
      [tenantId],
    );
    return result.rows;
  }

  async findTenantOutboundPolicy(tenantId: string): Promise<TenantPolicyRow | null> {
    const result = await this.db.query<TenantPolicyRow>(
      `SELECT country_allowlist, areacode_allowlist, premium_rate_blocklist,
              high_risk_blocklist, max_calls_per_hour, max_calls_per_day,
              max_call_duration_secs, deny_international_default
       FROM tenant_outbound_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createInboundRouteVersion(
    routeId: string,
    tenantId: string,
    definition: Record<string, unknown>,
    createdBy: string,
    // metadata intentionally not persisted (route_versions table has no metadata column)
  ): Promise<string> {
    const numResult = await this.db.query<{ max: string | null }>(
      `SELECT MAX(version_number) as max FROM route_versions
       WHERE route_id = $1 AND tenant_id = $2 AND route_type = 'inbound'`,
      [routeId, tenantId],
    );
    const nextNum = (parseInt(numResult.rows[0]?.max ?? '0', 10) || 0) + 1;

    const result = await this.db.query<{ id: string }>(
      `INSERT INTO route_versions
         (tenant_id, route_type, route_id, version_number, definition, created_by)
       VALUES ($1, 'inbound', $2, $3, $4::jsonb, $5)
       RETURNING id`,
      [tenantId, routeId, nextNum, JSON.stringify(definition), createdBy],
    );
    const versionId = result.rows[0]!.id;

    await this.db.query(
      `UPDATE inbound_routes SET draft_version_id = $2 WHERE id = $1 AND tenant_id = $3`,
      [routeId, versionId, tenantId],
    );

    return versionId;
  }

  async updateTenantOutboundPolicy(
    tenantId: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const fields = Object.keys(changes);
    if (fields.length === 0) return;

    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => changes[f]);

    await this.db.query(
      `UPDATE tenant_outbound_policies SET ${setClause} WHERE tenant_id = $1`,
      [tenantId, ...values],
    );
  }
}
