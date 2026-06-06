import type { AiRecommendationRepository } from './ai-recommendations.repository.js';
import type {
  AiRecommendation,
  AiRecommendationRiskLevel,
  AiRecommendationTargetType,
  CreateRecommendationInput,
  FraudPolicyRecommendationDetail,
  RecommendationDetail,
  RouteRecommendationDetail,
} from './ai-recommendations.types.js';

export class AiRecommendationNotFoundError extends Error {
  constructor(id: string) { super(`Recommendation not found: ${id}`); this.name = 'AiRecommendationNotFoundError'; }
}

export class AiRecommendationTargetNotFoundError extends Error {
  constructor(type: string, id: string) {
    super(`Recommendation target not found: ${type} ${id}`);
    this.name = 'AiRecommendationTargetNotFoundError';
  }
}

export class AiRecommendationStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'AiRecommendationStateError'; }
}

function parseIntent(intent: string): Record<string, string | boolean | number | null> {
  const lower = intent.toLowerCase();
  const result: Record<string, string | boolean | number | null> = {};

  if (lower.includes('queue')) result.target_type = 'queue';
  else if (lower.includes('extension') || lower.includes('ext ')) result.target_type = 'extension';
  else if (lower.includes('voicemail')) result.target_type = 'voicemail_box';
  else if (lower.includes('flow') || lower.includes('ivr')) result.target_type = 'flow';

  const rateMatch = lower.match(/(\d+)\s*(?:calls?\s*(?:per|\/)\s*hour)/);
  if (rateMatch) result.max_calls_per_hour = parseInt(rateMatch[1]!, 10);

  const dayMatch = lower.match(/(\d+)\s*(?:calls?\s*(?:per|\/)\s*day)/);
  if (dayMatch) result.max_calls_per_day = parseInt(dayMatch[1]!, 10);

  const durationMatch = lower.match(/(\d+)\s*(?:second|sec|minute|min)/);
  if (durationMatch) {
    const val = parseInt(durationMatch[1]!, 10);
    const isMinutes = lower.includes('minute') || lower.includes('min');
    result.max_call_duration_secs = isMinutes ? val * 60 : val;
  }

  if (lower.includes('block international') || lower.includes('no international') || lower.includes('deny international')) {
    result.deny_international_default = true;
  }
  if (lower.includes('allow international') || lower.includes('enable international')) {
    result.deny_international_default = false;
  }

  const countryMatch = lower.match(/\b([A-Z]{2}(?:,\s*[A-Z]{2})*)\b/g);
  if (countryMatch) result.country_list = countryMatch.join(',');

  return result;
}

function computeRiskLevel(
  targetType: AiRecommendationTargetType,
  affectedCount: number,
  hasActiveNumbers: boolean,
): AiRecommendationRiskLevel {
  if (targetType === 'fraud_policy') return affectedCount > 0 ? 'medium' : 'low';
  if (hasActiveNumbers && affectedCount > 0) return 'medium';
  return 'low';
}

export class AiRecommendationService {
  constructor(private readonly repo: AiRecommendationRepository) {}

  async list(tenantId: string, targetType?: AiRecommendationTargetType): Promise<AiRecommendation[]> {
    return this.repo.listByTenant(tenantId, targetType);
  }

  async getById(id: string, tenantId: string): Promise<AiRecommendation> {
    const rec = await this.repo.findById(id, tenantId);
    if (!rec) throw new AiRecommendationNotFoundError(id);
    return rec;
  }

  async create(tenantId: string, input: CreateRecommendationInput): Promise<AiRecommendation> {
    const rec = await this.repo.create(tenantId, input);

    const { recommendation, riskLevel, rationale, blastRadius } =
      await this.generateRecommendation(input.target_type, input.target_id ?? null, input.intent, tenantId);

    const updated = await this.repo.update(rec.id, tenantId, recommendation, riskLevel, rationale, blastRadius);
    return updated ?? rec;
  }

  async accept(id: string, tenantId: string, decidedBy: string, createdBy: string): Promise<{
    recommendation: AiRecommendation;
    draft_version_id?: string;
  }> {
    const rec = await this.repo.findById(id, tenantId);
    if (!rec) throw new AiRecommendationNotFoundError(id);
    if (rec.status !== 'pending') {
      throw new AiRecommendationStateError(`Recommendation is already ${rec.status}`);
    }
    if (!rec.recommendation) {
      throw new AiRecommendationStateError('Recommendation has no suggested changes to apply');
    }

    let draft_version_id: string | undefined;

    if (rec.target_type === 'inbound_route' && rec.target_id) {
      const detail = rec.recommendation as RouteRecommendationDetail;
      const route = await this.repo.findInboundRoute(rec.target_id, tenantId);
      if (!route) throw new AiRecommendationTargetNotFoundError(rec.target_type, rec.target_id);

      const definition = {
        match_type: route.match_type,
        match_value: route.match_value,
        target_type: route.target_type,
        target_id: route.target_id,
        ...detail.suggested_changes,
        ai_recommendation_id: id,
      };

      draft_version_id = await this.repo.createInboundRouteVersion(
        rec.target_id,
        tenantId,
        definition,
        createdBy,
      );
    } else if (rec.target_type === 'fraud_policy') {
      const detail = rec.recommendation as FraudPolicyRecommendationDetail;
      await this.repo.updateTenantOutboundPolicy(tenantId, detail.suggested_changes as Record<string, unknown>);
    }

    const accepted = await this.repo.accept(id, tenantId, decidedBy);
    return { recommendation: accepted ?? rec, draft_version_id };
  }

  async reject(id: string, tenantId: string, decidedBy: string): Promise<AiRecommendation> {
    const rec = await this.repo.findById(id, tenantId);
    if (!rec) throw new AiRecommendationNotFoundError(id);
    if (rec.status !== 'pending') {
      throw new AiRecommendationStateError(`Recommendation is already ${rec.status}`);
    }
    const rejected = await this.repo.reject(id, tenantId, decidedBy);
    return rejected ?? rec;
  }

  private async generateRecommendation(
    targetType: AiRecommendationTargetType,
    targetId: string | null,
    intent: string,
    tenantId: string,
  ): Promise<{
    recommendation: RecommendationDetail;
    riskLevel: AiRecommendationRiskLevel;
    rationale: string;
    blastRadius: string;
  }> {
    const parsed = parseIntent(intent);

    if (targetType === 'inbound_route' && targetId) {
      const route = await this.repo.findInboundRoute(targetId, tenantId);
      if (!route) throw new AiRecommendationTargetNotFoundError(targetType, targetId);
      const numbers = await this.repo.findPhoneNumbersForRoute(targetId, tenantId);

      const suggestedChanges: Record<string, unknown> = {};
      if (parsed.target_type) suggestedChanges.target_type = parsed.target_type;

      const detail: RouteRecommendationDetail = {
        type: 'inbound_route',
        suggested_changes: suggestedChanges,
        affected_numbers: numbers.map((n) => n.number),
        affected_routes: [{ id: route.id, name: route.name, status: route.status, role: 'target' }],
      };

      const riskLevel = computeRiskLevel(targetType, numbers.length, numbers.length > 0);
      const rationale = `Based on intent: "${intent}". Route "${route.name}" currently directs to ${route.target_type}. Suggested changes apply to the draft lifecycle and require validation before going live.`;
      const blastRadius = numbers.length > 0
        ? `${numbers.length} phone number(s) currently associated with this route will be affected when published.`
        : 'No phone numbers currently associated with this route.';

      return { recommendation: detail, riskLevel, rationale, blastRadius };
    }

    if (targetType === 'outbound_route' && targetId) {
      const route = await this.repo.findOutboundRoute(targetId, tenantId);
      if (!route) throw new AiRecommendationTargetNotFoundError(targetType, targetId);
      const activeRoutes = await this.repo.findActiveInboundRoutes(tenantId);

      const detail: RouteRecommendationDetail = {
        type: 'outbound_route',
        suggested_changes: {},
        affected_numbers: [],
        affected_routes: activeRoutes.slice(0, 5).map((r) => ({ ...r, role: 'active_route' })),
      };

      const rationale = `Based on intent: "${intent}". Outbound route "${route.name}" uses prefix "${route.match_prefix}".`;
      const blastRadius = `Priority ${route.priority} route. Changes affect all calls matching prefix "${route.match_prefix}".`;

      return { recommendation: detail, riskLevel: 'low', rationale, blastRadius };
    }

    if (targetType === 'fraud_policy') {
      const policy = await this.repo.findTenantOutboundPolicy(tenantId);
      const suggestedChanges: Record<string, unknown> = {};

      if (parsed.max_calls_per_hour !== undefined) suggestedChanges.max_calls_per_hour = parsed.max_calls_per_hour;
      if (parsed.max_calls_per_day !== undefined) suggestedChanges.max_calls_per_day = parsed.max_calls_per_day;
      if (parsed.max_call_duration_secs !== undefined) suggestedChanges.max_call_duration_secs = parsed.max_call_duration_secs;
      if (parsed.deny_international_default !== undefined) suggestedChanges.deny_international_default = parsed.deny_international_default;

      const detail: FraudPolicyRecommendationDetail = {
        type: 'fraud_policy',
        suggested_changes: suggestedChanges,
      };

      const currentState = policy
        ? `Currently: max_calls_per_hour=${policy.max_calls_per_hour ?? 'unlimited'}, deny_international=${policy.deny_international_default}.`
        : 'No current policy found.';
      const rationale = `Based on intent: "${intent}". ${currentState}`;
      const blastRadius = Object.keys(suggestedChanges).length > 0
        ? `${Object.keys(suggestedChanges).length} fraud policy field(s) will be updated immediately on acceptance.`
        : 'No specific changes inferred from intent. Review and edit manually.';

      return { recommendation: detail, riskLevel: 'medium', rationale, blastRadius };
    }

    throw new AiRecommendationTargetNotFoundError(targetType, targetId ?? '');
  }
}
