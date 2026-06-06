import type { IncidentInvestigationRepository } from './incident-investigation.repository.js';
import type {
  CallEventRow,
  GatewayStatusRow,
  IncidentInvestigation,
  InvestigationCitation,
  InvestigationContext,
  RouteRow,
} from './incident-investigation.types.js';

export class IncidentInvestigationNotFoundError extends Error {
  constructor(id: string) { super(`Investigation not found: ${id}`); this.name = 'IncidentInvestigationNotFoundError'; }
}

function classifyQuestion(question: string): 'calls' | 'routes' | 'gateway' | 'policy' | 'general' {
  const lower = question.toLowerCase();
  if (lower.includes('call') || lower.includes('fail') || lower.includes('drop') || lower.includes('reject')) return 'calls';
  if (lower.includes('route') || lower.includes('incoming') || lower.includes('inbound') || lower.includes('outbound')) return 'routes';
  if (lower.includes('gateway') || lower.includes('trunk') || lower.includes('sip') || lower.includes('carrier')) return 'gateway';
  if (lower.includes('fraud') || lower.includes('policy') || lower.includes('block') || lower.includes('limit')) return 'policy';
  return 'general';
}

function formatEventType(type: string): string {
  return type.replace(/^call\./, '').replace(/_/g, ' ');
}

function buildCallCitations(events: CallEventRow[]): InvestigationCitation[] {
  const byCall = new Map<string, CallEventRow[]>();
  for (const e of events) {
    const list = byCall.get(e.call_id) ?? [];
    list.push(e);
    byCall.set(e.call_id, list);
  }

  const citations: InvestigationCitation[] = [];
  for (const [callId, callEvents] of byCall.entries()) {
    const failEvents = callEvents.filter((e) =>
      e.event_type.includes('fail') || e.event_type.includes('reject') || e.event_type.includes('no_answer'),
    );
    const lastEvent = callEvents[callEvents.length - 1];
    if (!lastEvent) continue;

    const factParts = failEvents.length > 0
      ? failEvents.map((e) => `${formatEventType(e.event_type)} (source: ${e.source ?? 'unknown'})`)
      : [`last event: ${formatEventType(lastEvent.event_type)}`];

    citations.push({
      source: 'call_event',
      id: callId,
      label: `Call ${callId.slice(0, 8)}`,
      fact: factParts.join('; '),
    });
  }
  return citations;
}

function buildRouteCitations(routes: RouteRow[]): InvestigationCitation[] {
  return routes.map((r) => ({
    source: 'inbound_route' as const,
    id: r.id,
    label: r.name,
    fact: `Status: ${r.status}, match: ${r.match_type ?? 'n/a'}=${r.match_value ?? 'n/a'}, target: ${r.target_type ?? 'none'}`,
  }));
}

function buildGatewayCitations(gateways: GatewayStatusRow[]): InvestigationCitation[] {
  return gateways.map((g) => ({
    source: 'gateway_status' as const,
    id: g.gateway_name,
    label: g.gateway_name,
    fact: `State: ${g.state}, ping: ${g.ping_time_ms != null ? `${g.ping_time_ms}ms` : 'unknown'}, last seen: ${g.updated_at.toISOString()}`,
  }));
}

function synthesizeAnswer(
  question: string,
  category: 'calls' | 'routes' | 'gateway' | 'policy' | 'general',
  citations: InvestigationCitation[],
  context: InvestigationContext,
): string {
  if (citations.length === 0) {
    return `No data found relevant to: "${question}". This may mean no events or routes exist for the given context, or the time range produced no results.`;
  }

  const lines: string[] = [`Investigation of: "${question}"`, ''];

  if (category === 'calls') {
    const failCitations = citations.filter((c) => c.fact.includes('fail') || c.fact.includes('reject') || c.fact.includes('no_answer'));
    if (failCitations.length > 0) {
      lines.push(`Found ${failCitations.length} call(s) with failure events:`);
      for (const c of failCitations.slice(0, 5)) {
        lines.push(`  - ${c.label}: ${c.fact}`);
      }
    } else {
      lines.push(`Found ${citations.length} call event record(s). No failure events detected in the specified scope.`);
    }
  } else if (category === 'routes') {
    const inactive = citations.filter((c) => c.fact.includes('inactive') || c.fact.includes('draft'));
    if (inactive.length > 0) {
      lines.push(`Found ${inactive.length} route(s) in non-active state:`);
      for (const c of inactive.slice(0, 5)) {
        lines.push(`  - ${c.label}: ${c.fact}`);
      }
    } else {
      lines.push(`Found ${citations.length} active route(s) — all appear correctly configured.`);
    }
  } else if (category === 'gateway') {
    const degraded = citations.filter((c) => c.fact.includes('down') || c.fact.includes('fail') || c.fact.includes('timeout'));
    if (degraded.length > 0) {
      lines.push(`Found ${degraded.length} gateway(s) in degraded state:`);
      for (const c of degraded.slice(0, 5)) {
        lines.push(`  - ${c.label}: ${c.fact}`);
      }
    } else {
      lines.push(`Found ${citations.length} gateway(s) — all appear healthy.`);
    }
  } else {
    lines.push(`Found ${citations.length} data point(s) relevant to the investigation.`);
  }

  if (context.time_range) {
    lines.push('', `Time range: ${context.time_range.from} to ${context.time_range.to}`);
  }

  lines.push('', 'This analysis is advisory only and cites observed product data. No changes have been made.');
  return lines.join('\n');
}

export class IncidentInvestigationService {
  constructor(private readonly repo: IncidentInvestigationRepository) {}

  async list(tenantId: string): Promise<IncidentInvestigation[]> {
    return this.repo.listByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<IncidentInvestigation> {
    const inv = await this.repo.findById(id, tenantId);
    if (!inv) throw new IncidentInvestigationNotFoundError(id);
    return inv;
  }

  async investigate(
    tenantId: string,
    question: string,
    context: InvestigationContext,
    createdBy: string | null,
    canViewRecordings: boolean,
  ): Promise<IncidentInvestigation> {
    const category = classifyQuestion(question);
    const citations: InvestigationCitation[] = [];
    const dataSources: string[] = [];

    // Gather call events
    if (context.call_ids?.length) {
      const events = await this.repo.findCallEvents(context.call_ids, tenantId);
      citations.push(...buildCallCitations(events));
      if (events.length) dataSources.push('call_events');
    } else if (context.time_range) {
      const events = await this.repo.findCallEventsByTimeRange(tenantId, context.time_range.from, context.time_range.to);
      citations.push(...buildCallCitations(events));
      if (events.length) dataSources.push('call_events');
    } else if (category === 'calls') {
      const recent = await this.repo.findRecentFailedCalls(tenantId);
      const pseudoEvents: CallEventRow[] = recent.map((r) => ({
        call_id: r.call_id,
        event_type: r.event_type,
        event_time: r.event_time,
        source: r.source,
        payload: {},
      }));
      citations.push(...buildCallCitations(pseudoEvents));
      if (recent.length) dataSources.push('call_events');
    }

    // Gather route data
    if (context.route_ids?.length) {
      const routes = await this.repo.findInboundRoutes(context.route_ids, tenantId);
      citations.push(...buildRouteCitations(routes));
      if (routes.length) dataSources.push('inbound_routes');
    } else if (category === 'routes' || category === 'general') {
      const routes = await this.repo.findAllActiveInboundRoutes(tenantId);
      citations.push(...buildRouteCitations(routes));
      if (routes.length) dataSources.push('inbound_routes');
    }

    // Gather gateway state
    if (category === 'gateway' || category === 'general') {
      const gateways = await this.repo.findGatewayStatus(tenantId);
      citations.push(...buildGatewayCitations(gateways));
      if (gateways.length) dataSources.push('gateway_status');
    }

    // Recording citations are only included if operator has permission
    if (canViewRecordings && context.call_ids?.length) {
      // Recording data is gathered when analysis results are already stored
      dataSources.push('recordings_allowed');
    }

    const answer = synthesizeAnswer(question, category, citations, context);

    return this.repo.create(tenantId, question, context, answer, citations, dataSources, createdBy);
  }
}
