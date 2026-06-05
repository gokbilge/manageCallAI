import type { ReportingRepository } from './reporting.repository.js';
import type {
  AggregationMode,
  CallDirection,
  CallStatus,
  NlQueryResult,
  ParsedQuery,
  ReportFilter,
  TimeRange,
} from './reporting.types.js';

export class NlQueryNotSupportedError extends Error {
  readonly supportedExamples: string[];
  constructor(message: string, examples: string[]) {
    super(message);
    this.name = 'NlQueryNotSupportedError';
    this.supportedExamples = examples;
  }
}

const SUPPORTED_EXAMPLES = [
  'show failed calls',
  'show outbound calls today',
  'how many inbound calls last 7 days',
  'show active calls',
  'count failed outbound calls',
  'show calls yesterday',
  'show completed calls last hour',
];

const CALL_TERMS = ['call', 'calls', 'inbound', 'outbound', 'failed', 'completed',
  'active', 'ongoing', 'dispatched', 'hung up', 'hangup', 'answered'];

function parseQuery(raw: string): ParsedQuery | null {
  const q = raw.toLowerCase().trim();

  if (!CALL_TERMS.some(t => q.includes(t))) return null;

  const direction: CallDirection | undefined =
    q.includes('outbound') ? 'outbound' :
    q.includes('inbound') ? 'inbound' :
    undefined;

  const status: CallStatus | undefined =
    (q.includes('failed') || q.includes('fail')) ? 'failed' :
    (q.includes('completed') || q.includes('complete') || q.includes('hung up') || q.includes('hangup')) ? 'completed' :
    (q.includes('active') || q.includes('ongoing') || q.includes('answered')) ? 'active' :
    undefined;

  const time_range: TimeRange | undefined =
    (q.includes('last hour') || q.includes('past hour')) ? 'last_hour' :
    q.includes('yesterday') ? 'yesterday' :
    (q.includes('today') || q.includes('this day')) ? 'today' :
    (q.includes('last 7') || q.includes('seven day') || q.includes('last week') || q.includes('past week')) ? 'last_7_days' :
    undefined;

  const aggregation: AggregationMode =
    (q.includes('how many') || q.includes('count') || q.includes('total') || q.includes('number of')) ? 'count' : 'list';

  return { direction, status, time_range, aggregation, raw };
}

function buildFilters(parsed: ParsedQuery): ReportFilter[] {
  const filters: ReportFilter[] = [];
  if (parsed.direction) filters.push({ dimension: 'direction', value: parsed.direction });
  if (parsed.status) filters.push({ dimension: 'status', value: parsed.status });
  if (parsed.time_range) filters.push({ dimension: 'time_range', value: parsed.time_range });
  if (parsed.aggregation === 'count') filters.push({ dimension: 'aggregation', value: 'count' });
  return filters;
}

function buildExplanation(parsed: ParsedQuery, count: number): string {
  const parts: string[] = [];
  if (parsed.direction) parts.push(`${parsed.direction} calls`);
  else parts.push('calls (all directions)');
  if (parsed.status) parts.push(`with status: ${parsed.status}`);

  const rangeLabel =
    parsed.time_range === 'last_hour' ? 'in the last hour' :
    parsed.time_range === 'today' ? 'today' :
    parsed.time_range === 'yesterday' ? 'yesterday' :
    parsed.time_range === 'last_7_days' ? 'in the last 7 days' :
    'in the last 24 hours (default window)';
  parts.push(rangeLabel);

  const base = `Showing ${parts.join(', ')}.`;
  if (parsed.aggregation === 'count') return `${base} Found ${count} matching event(s).`;
  return `${base} Showing up to 50 most recent events (${count} found).`;
}

export class NlReportingService {
  constructor(private readonly repo: ReportingRepository) {}

  async query(question: string, tenantId: string): Promise<NlQueryResult> {
    const parsed = parseQuery(question);

    if (!parsed) {
      throw new NlQueryNotSupportedError(
        `Question not recognized as a supported call reporting query. ` +
        `Supported queries are about calls, directions (inbound/outbound), ` +
        `statuses (failed/completed/active), and time ranges.`,
        SUPPORTED_EXAMPLES,
      );
    }

    const filters = buildFilters(parsed);
    const opts = { direction: parsed.direction, status: parsed.status, time_range: parsed.time_range };

    let results: NlQueryResult['results'] = [];
    let count: number;

    if (parsed.aggregation === 'count') {
      count = await this.repo.countCallEvents(tenantId, opts);
    } else {
      results = await this.repo.queryCallEvents(tenantId, { ...opts, limit: 50 });
      count = results.length;
    }

    return {
      question,
      applied_filters: filters,
      explanation: buildExplanation(parsed, count),
      result_count: count,
      results,
      is_advisory: true,
      queried_at: new Date().toISOString(),
    };
  }
}
