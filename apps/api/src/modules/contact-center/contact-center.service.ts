import type {
  CreateDispositionCodeBody,
  CreateQaReviewBody,
  CreateQaScorecardBody,
  UpdateDispositionCodeBody,
  UpdateQaReviewBody,
  UpdateQaScorecardBody,
  UpsertCallDispositionBody,
  UpsertQueueSlaPolicyBody,
} from '@managecallai/contracts';
import type { ContactCenterRepository, RawCallEventRow } from './contact-center.repository.js';
import type {
  AgentAvailabilityBucket,
  CallDisposition,
  DispositionCode,
  QaReview,
  QaScorecard,
  QueueWallboardMetric,
  SupervisorSnapshot,
} from './contact-center.types.js';

export class ContactCenterValidationError extends Error {}
export class ContactCenterNotFoundError extends Error {}

type CallSummary = {
  call_id: string;
  queue_id: string | null;
  status: 'active' | 'completed' | 'failed';
  wait_seconds: number | null;
};

function readNested(payload: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = payload;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readString(payload: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    const value = readNested(payload, path);
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function readNumber(payload: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readNested(payload, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function extractQueueId(payload: Record<string, unknown>): string | null {
  return readString(payload, [
    ['queue_id'],
    ['metadata', 'queue_id'],
    ['queue', 'id'],
  ]);
}

function extractWaitSeconds(payload: Record<string, unknown>): number | null {
  return readNumber(payload, [
    ['queue_wait_seconds'],
    ['wait_seconds'],
    ['metadata', 'queue_wait_seconds'],
    ['metadata', 'wait_seconds'],
  ]);
}

function extractFailureReason(payload: Record<string, unknown>): string | null {
  return readString(payload, [
    ['failure_reason'],
    ['hangup_cause'],
    ['final_disposition'],
    ['disposition'],
    ['metadata', 'failure_reason'],
    ['metadata', 'hangup_cause'],
    ['metadata', 'final_disposition'],
    ['metadata', 'disposition'],
  ]);
}

function isCompletionEvent(eventType: string): boolean {
  return eventType === 'call.completed'
    || eventType === 'outbound_call_completed'
    || eventType === 'channel_hangup';
}

function isFailureEvent(eventType: string, payload: Record<string, unknown>): boolean {
  if (eventType.includes('failed')) return true;
  const reason = extractFailureReason(payload)?.toUpperCase();
  if (!reason) return false;
  return !['NORMAL_CLEARING', 'ANSWERED', 'COMPLETED', 'SUCCESS'].includes(reason);
}

function summarizeCalls(rows: RawCallEventRow[]): CallSummary[] {
  const grouped = new Map<string, RawCallEventRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.call_id);
    if (bucket) bucket.push(row);
    else grouped.set(row.call_id, [row]);
  }

  return [...grouped.values()].map((events) => {
    const queue_id = events.map((event) => extractQueueId(event.payload)).find(Boolean) ?? null;
    const wait_seconds = events.map((event) => extractWaitSeconds(event.payload)).find((value) => value != null) ?? null;
    const failed = [...events].reverse().find((event) => isFailureEvent(event.event_type, event.payload));
    const completed = events.some((event) => isCompletionEvent(event.event_type));
    return {
      call_id: events[0]!.call_id,
      queue_id,
      status: failed ? 'failed' : completed ? 'completed' : 'active',
      wait_seconds,
    };
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class ContactCenterService {
  constructor(private readonly repo: ContactCenterRepository) {}

  async getQueueSlaPolicy(queueId: string, tenantId: string) {
    if (!(await this.repo.queueExists(queueId, tenantId))) {
      throw new ContactCenterNotFoundError(`Queue not found: ${queueId}`);
    }
    const current = await this.repo.getQueueSlaPolicy(queueId, tenantId);
    return current ?? this.repo.upsertQueueSlaPolicy(queueId, tenantId, {});
  }

  async getSupervisorSnapshot(tenantId: string): Promise<SupervisorSnapshot> {
    const [queues, tenantAvailability, queueAvailability, callEvents, dispositionUsage, qaSummary] = await Promise.all([
      this.repo.listQueuesWithPolicies(tenantId),
      this.repo.listAgentAvailabilityCounts(tenantId),
      this.repo.listQueueAgentAvailabilityCounts(tenantId),
      this.repo.listRecentCallEvents(tenantId),
      this.repo.listDispositionUsage(tenantId),
      this.repo.getQaSummary(tenantId),
    ]);

    const queueAvailabilityMap = new Map<string, Record<AgentAvailabilityBucket['state'], number>>();
    for (const row of queueAvailability) {
      const current = queueAvailabilityMap.get(row.queue_id) ?? {
        available: 0,
        busy: 0,
        away: 0,
        wrap_up: 0,
        offline: 0,
      };
      current[row.state] = row.count;
      queueAvailabilityMap.set(row.queue_id, current);
    }

    const queueMetricsMap = new Map<string, QueueWallboardMetric>();
    for (const queue of queues) {
      const availability = queueAvailabilityMap.get(queue.queue_id) ?? {
        available: 0,
        busy: 0,
        away: 0,
        wrap_up: 0,
        offline: 0,
      };
      queueMetricsMap.set(queue.queue_id, {
        queue_id: queue.queue_id,
        queue_name: queue.queue_name,
        member_count: queue.member_count,
        available_agents: availability.available,
        busy_agents: availability.busy,
        away_agents: availability.away,
        wrap_up_agents: availability.wrap_up,
        offline_agents: availability.offline,
        offered_calls_24h: 0,
        answered_calls_24h: 0,
        abandoned_calls_24h: 0,
        active_calls: 0,
        average_wait_seconds: null,
        max_wait_seconds: null,
        answer_target_seconds: queue.answer_target_seconds,
        answer_rate_target_percent: queue.answer_rate_target_percent,
        abandonment_threshold_percent: queue.abandonment_threshold_percent,
        within_sla_calls_24h: 0,
        sla_percent_24h: null,
        wallboard_enabled: queue.wallboard_enabled,
        alert_state: 'healthy',
      });
    }

    const summaries = summarizeCalls(callEvents);
    const waitTotals = new Map<string, { sum: number; count: number; max: number }>();

    for (const summary of summaries) {
      if (!summary.queue_id) continue;
      const metric = queueMetricsMap.get(summary.queue_id);
      if (!metric) continue;

      metric.offered_calls_24h += 1;
      if (summary.status === 'completed') metric.answered_calls_24h += 1;
      if (summary.status === 'failed') metric.abandoned_calls_24h += 1;
      if (summary.status === 'active') metric.active_calls += 1;

      if (summary.wait_seconds != null) {
        const current = waitTotals.get(summary.queue_id) ?? { sum: 0, count: 0, max: 0 };
        current.sum += summary.wait_seconds;
        current.count += 1;
        current.max = Math.max(current.max, summary.wait_seconds);
        waitTotals.set(summary.queue_id, current);
      }

      if (summary.status === 'completed' && summary.wait_seconds != null && summary.wait_seconds <= metric.answer_target_seconds) {
        metric.within_sla_calls_24h += 1;
      }
    }

    for (const metric of queueMetricsMap.values()) {
      const waits = waitTotals.get(metric.queue_id);
      if (waits && waits.count > 0) {
        metric.average_wait_seconds = round2(waits.sum / waits.count);
        metric.max_wait_seconds = waits.max;
      }

      if (metric.answered_calls_24h > 0) {
        metric.sla_percent_24h = round2((metric.within_sla_calls_24h / metric.answered_calls_24h) * 100);
      }

      const abandonmentPercent = metric.offered_calls_24h > 0
        ? (metric.abandoned_calls_24h / metric.offered_calls_24h) * 100
        : 0;

      if (
        (metric.sla_percent_24h != null && metric.sla_percent_24h < metric.answer_rate_target_percent - 10)
        || abandonmentPercent > metric.abandonment_threshold_percent + 5
      ) {
        metric.alert_state = 'critical';
      } else if (
        (metric.sla_percent_24h != null && metric.sla_percent_24h < metric.answer_rate_target_percent)
        || abandonmentPercent > metric.abandonment_threshold_percent
      ) {
        metric.alert_state = 'warning';
      }
    }

    const agentStates: AgentAvailabilityBucket['state'][] = [
      'available',
      'busy',
      'away',
      'wrap_up',
      'offline',
    ];
    const agent_availability: AgentAvailabilityBucket[] = agentStates.map((state) => ({
      state,
      count: tenantAvailability.find((row) => row.state === state)?.count ?? 0,
    }));

    return {
      generated_at: new Date().toISOString(),
      queue_metrics: [...queueMetricsMap.values()],
      agent_availability,
      disposition_usage_24h: dispositionUsage,
      qa_summary: qaSummary,
    };
  }

  async upsertQueueSlaPolicy(queueId: string, tenantId: string, input: UpsertQueueSlaPolicyBody) {
    if (!(await this.repo.queueExists(queueId, tenantId))) {
      throw new ContactCenterNotFoundError(`Queue not found: ${queueId}`);
    }
    return this.repo.upsertQueueSlaPolicy(queueId, tenantId, input);
  }

  async listDispositionCodes(tenantId: string) {
    return this.repo.listDispositionCodes(tenantId);
  }

  async createDispositionCode(tenantId: string, input: CreateDispositionCodeBody): Promise<DispositionCode> {
    if (input.queue_id && !(await this.repo.queueExists(input.queue_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Queue not found: ${input.queue_id}`);
    }
    return this.repo.createDispositionCode(tenantId, {
      queue_id: input.queue_id ?? null,
      code: input.code.trim(),
      label: input.label.trim(),
      description: input.description ?? null,
      sort_order: input.sort_order ?? 0,
      status: input.status ?? 'active',
    });
  }

  async updateDispositionCode(id: string, tenantId: string, input: UpdateDispositionCodeBody): Promise<DispositionCode> {
    if (input.queue_id && !(await this.repo.queueExists(input.queue_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Queue not found: ${input.queue_id}`);
    }
    const updated = await this.repo.updateDispositionCode(id, tenantId, {
      queue_id: input.queue_id,
      code: input.code?.trim(),
      label: input.label?.trim(),
      description: input.description,
      sort_order: input.sort_order,
      status: input.status,
    });
    if (!updated) throw new ContactCenterNotFoundError(`Disposition code not found: ${id}`);
    return updated;
  }

  async getCallDisposition(callId: string, tenantId: string): Promise<CallDisposition | null> {
    return this.repo.findCallDisposition(callId, tenantId);
  }

  async upsertCallDisposition(callId: string, tenantId: string, actorId: string, input: UpsertCallDispositionBody): Promise<CallDisposition> {
    let code: DispositionCode | null = null;
    if (input.queue_id && !(await this.repo.queueExists(input.queue_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Queue not found: ${input.queue_id}`);
    }
    if (input.agent_profile_id && !(await this.repo.agentProfileExists(input.agent_profile_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Agent profile not found: ${input.agent_profile_id}`);
    }
    if (input.disposition_code_id) {
      code = await this.repo.findDispositionCodeById(input.disposition_code_id, tenantId);
      if (!code) throw new ContactCenterNotFoundError(`Disposition code not found: ${input.disposition_code_id}`);
      if (code.status !== 'active') throw new ContactCenterValidationError('Disposition code must be active');
    }

    return this.repo.upsertCallDisposition(tenantId, callId, actorId, {
      queue_id: input.queue_id ?? null,
      agent_profile_id: input.agent_profile_id ?? null,
      disposition_code_id: code?.id ?? null,
      disposition_code: code?.code ?? null,
      disposition_label: code?.label ?? null,
      note_text: input.note_text ?? null,
    });
  }

  async listQaScorecards(tenantId: string): Promise<QaScorecard[]> {
    return this.repo.listQaScorecards(tenantId);
  }

  async createQaScorecard(tenantId: string, actorId: string, input: CreateQaScorecardBody): Promise<QaScorecard> {
    this.validateScorecardCriteria(input.criteria_json);
    return this.repo.createQaScorecard(tenantId, actorId, {
      name: input.name.trim(),
      description: input.description ?? null,
      status: input.status ?? 'active',
      criteria_json: input.criteria_json,
    });
  }

  async updateQaScorecard(id: string, tenantId: string, input: UpdateQaScorecardBody): Promise<QaScorecard> {
    if (input.criteria_json) this.validateScorecardCriteria(input.criteria_json);
    const updated = await this.repo.updateQaScorecard(id, tenantId, {
      name: input.name?.trim(),
      description: input.description,
      status: input.status,
      criteria_json: input.criteria_json,
    });
    if (!updated) throw new ContactCenterNotFoundError(`QA scorecard not found: ${id}`);
    return updated;
  }

  async listQaReviews(tenantId: string): Promise<QaReview[]> {
    return this.repo.listQaReviews(tenantId);
  }

  async createQaReview(tenantId: string, actorId: string, input: CreateQaReviewBody): Promise<QaReview> {
    return this.persistQaReview(null, tenantId, actorId, input);
  }

  async updateQaReview(id: string, tenantId: string, actorId: string, input: UpdateQaReviewBody): Promise<QaReview> {
    const existing = await this.repo.findQaReviewById(id, tenantId);
    if (!existing) throw new ContactCenterNotFoundError(`QA review not found: ${id}`);
    return this.persistQaReview(existing.id, tenantId, actorId, {
      call_id: existing.call_id,
      queue_id: input.queue_id ?? existing.queue_id,
      agent_profile_id: input.agent_profile_id ?? existing.agent_profile_id,
      recording_id: input.recording_id ?? existing.recording_id,
      disposition_id: input.disposition_id ?? existing.disposition_id,
      scorecard_id: existing.scorecard_id,
      scores_json: input.scores_json ?? existing.scores_json,
      note_text: input.note_text ?? existing.note_text,
      status: input.status ?? existing.status,
    });
  }

  private async persistQaReview(
    reviewId: string | null,
    tenantId: string,
    actorId: string,
    input: {
      call_id: string;
      queue_id?: string | null;
      agent_profile_id?: string | null;
      recording_id?: string | null;
      disposition_id?: string | null;
      scorecard_id: string;
      scores_json: CreateQaReviewBody['scores_json'];
      note_text?: string | null;
      status?: CreateQaReviewBody['status'];
    },
  ): Promise<QaReview> {
    const scorecard = await this.repo.findQaScorecardById(input.scorecard_id, tenantId);
    if (!scorecard) throw new ContactCenterNotFoundError(`QA scorecard not found: ${input.scorecard_id}`);
    if (scorecard.status !== 'active' && reviewId == null) {
      throw new ContactCenterValidationError('QA scorecard must be active');
    }
    if (input.queue_id && !(await this.repo.queueExists(input.queue_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Queue not found: ${input.queue_id}`);
    }
    if (input.agent_profile_id && !(await this.repo.agentProfileExists(input.agent_profile_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Agent profile not found: ${input.agent_profile_id}`);
    }
    if (input.recording_id && !(await this.repo.recordingExists(input.recording_id, tenantId))) {
      throw new ContactCenterNotFoundError(`Recording not found: ${input.recording_id}`);
    }
    if (input.disposition_id) {
      const disposition = await this.repo.findCallDisposition(input.call_id, tenantId);
      if (!disposition || disposition.id !== input.disposition_id) {
        throw new ContactCenterNotFoundError(`Call disposition not found: ${input.disposition_id}`);
      }
    }

    const { totalScore, maxScore } = this.validateReviewScores(scorecard.criteria_json, input.scores_json);
    const status = input.status ?? 'draft';

    if (reviewId) {
      const updated = await this.repo.updateQaReview(reviewId, tenantId, {
        queue_id: input.queue_id ?? null,
        agent_profile_id: input.agent_profile_id ?? null,
        recording_id: input.recording_id ?? null,
        disposition_id: input.disposition_id ?? null,
        status,
        scores_json: input.scores_json,
        note_text: input.note_text ?? null,
        total_score: totalScore,
        max_score: maxScore,
      });
      if (!updated) throw new ContactCenterNotFoundError(`QA review not found: ${reviewId}`);
      return updated;
    }

    return this.repo.createQaReview(tenantId, actorId, {
      call_id: input.call_id,
      queue_id: input.queue_id ?? null,
      agent_profile_id: input.agent_profile_id ?? null,
      recording_id: input.recording_id ?? null,
      disposition_id: input.disposition_id ?? null,
      scorecard_id: input.scorecard_id,
      status,
      scores_json: input.scores_json,
      note_text: input.note_text ?? null,
      total_score: totalScore,
      max_score: maxScore,
    });
  }

  private validateScorecardCriteria(criteria: QaScorecard['criteria_json']): void {
    const seen = new Set<string>();
    for (const item of criteria) {
      if (seen.has(item.key)) {
        throw new ContactCenterValidationError(`Duplicate scorecard criterion key: ${item.key}`);
      }
      seen.add(item.key);
    }
  }

  private validateReviewScores(criteria: QaScorecard['criteria_json'], scores: CreateQaReviewBody['scores_json']) {
    const criteriaMap = new Map(criteria.map((item) => [item.key, item]));
    let totalScore = 0;
    let maxScore = 0;

    for (const score of scores) {
      const criterion = criteriaMap.get(score.key);
      if (!criterion) {
        throw new ContactCenterValidationError(`Unknown QA criterion: ${score.key}`);
      }
      if (score.max_score !== criterion.max_score) {
        throw new ContactCenterValidationError(`QA criterion max score mismatch for: ${score.key}`);
      }
      if (score.score > score.max_score) {
        throw new ContactCenterValidationError(`QA score exceeds max for: ${score.key}`);
      }
      totalScore += score.score;
      maxScore += score.max_score;
    }

    if (scores.length !== criteria.length) {
      throw new ContactCenterValidationError('QA review must score every scorecard criterion');
    }

    return { totalScore, maxScore };
  }
}
