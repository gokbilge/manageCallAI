import type { CallFailureExplanationRepository } from './call-failure-explanation.repository.js';
import type {
  CallEventRow,
  CallFailureExplanation,
  ExplainEventSummary,
  FailureFact,
} from './call-failure-explanation.types.js';

export class CallNotFoundError extends Error {
  constructor(callId: string) {
    super(`No call events found for call_id: ${callId}`);
    this.name = 'CallNotFoundError';
  }
}

// Hangup causes that represent a normal call completion, not a failure.
const NORMAL_HANGUP_CAUSES = new Set([
  'NORMAL_CLEARING',
  'ORIGINATOR_CANCEL',
  'NORMAL_UNSPECIFIED',
  'LOSE_RACE',
  'MANAGER_REQUEST',
]);

interface FailureExplanation {
  cause: string;
  action: string;
}

const FAILURE_MAP: Record<string, FailureExplanation> = {
  NO_ROUTE_FOR_PREFIX: {
    cause: 'No outbound route matched the dialed number prefix.',
    action: 'Check outbound routes and ensure a route with a matching prefix is active for this tenant.',
  },
  TRUNK_NOT_REGISTERED: {
    cause: 'The SIP trunk was not registered in FreeSWITCH at call time.',
    action: 'Verify trunk registration in the runtime status page and check SIP credentials.',
  },
  NO_ROUTE_DESTINATION: {
    cause: 'No routing destination was found for the called number.',
    action: 'Verify the outbound route configuration and ensure the SIP trunk is active.',
  },
  USER_BUSY: {
    cause: 'The remote party was busy when the call was placed.',
    action: 'Retry later or configure a fallback trunk for automatic retry.',
  },
  NO_ANSWER: {
    cause: 'The remote party did not answer within the timeout window.',
    action: 'Check whether the called number is reachable and consider adjusting ring timeout.',
  },
  SUBSCRIBER_ABSENT: {
    cause: 'The called SIP endpoint or extension was not registered.',
    action: 'Verify the extension is online by checking the runtime extensions view.',
  },
  CALL_REJECTED: {
    cause: 'The call was rejected by the remote carrier or endpoint.',
    action: 'Check carrier-side ACLs and ensure the originating number is authorized.',
  },
  RECOVERY_ON_TIMER_EXPIRE: {
    cause: 'The call timed out before connecting.',
    action: 'Check network latency between the platform and the SIP trunk.',
  },
  NORMAL_TEMPORARY_FAILURE: {
    cause: 'A temporary network or routing failure prevented the call from completing.',
    action: 'Retry the call. If failures persist, check the SIP trunk and network path.',
  },
  NETWORK_OUT_OF_ORDER: {
    cause: 'Network connectivity issue prevented the call from completing.',
    action: 'Check network connectivity between the platform and the SIP trunk.',
  },
  INCOMPATIBLE_DESTINATION: {
    cause: 'The destination does not support the offered media or codec.',
    action: 'Review codec configuration on the SIP trunk.',
  },
  UNALLOCATED_NUMBER: {
    cause: 'The dialed number is not allocated or does not exist.',
    action: 'Verify the destination number is correct.',
  },
  INVALID_NUMBER_FORMAT: {
    cause: 'The dialed number format was invalid.',
    action: 'Ensure numbers are formatted in E.164 format (e.g. +1XXXXXXXXXX).',
  },
};

function readString(obj: unknown, keys: string[]): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  for (const key of keys) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return undefined;
}

function extractFailureReason(event: CallEventRow): string | undefined {
  return readString(event.payload, [
    'failure_reason',
    'Hangup-Cause',
    'HangupCause',
    'hangup_cause',
  ]) ?? readString((event.payload as Record<string, unknown>)['metadata'], [
    'failure_reason',
  ]);
}

function isFailureHangup(event: CallEventRow): boolean {
  const cause = readString(event.payload, ['Hangup-Cause', 'HangupCause', 'hangup_cause']);
  if (!cause) return false;
  return !NORMAL_HANGUP_CAUSES.has(cause.toUpperCase());
}

function isFailureEvent(event: CallEventRow): boolean {
  const t = event.event_type.toLowerCase();
  if (t.endsWith('_failed') || t.includes('failure')) return true;
  if (event.event_type === 'CHANNEL_HANGUP_COMPLETE') return isFailureHangup(event);
  return false;
}

function mapToExplanation(failureReason: string | undefined): FailureExplanation {
  if (!failureReason) {
    return {
      cause: 'The call failed but no specific failure reason was captured in the event data.',
      action: 'Check the event payload details and SIP trunk logs for more context.',
    };
  }
  const upper = failureReason.toUpperCase().replace(/-/g, '_');
  return FAILURE_MAP[upper] ?? FAILURE_MAP[failureReason.toUpperCase()] ?? {
    cause: `Call failed with reason: ${failureReason}.`,
    action: 'Check the SIP trunk logs and runtime status for more context.',
  };
}

function buildFacts(events: CallEventRow[], failureEvent: CallEventRow): FailureFact[] {
  const facts: FailureFact[] = [];

  facts.push({
    code: 'EVENT_COUNT',
    observed: `${events.length} event(s) recorded for this call.`,
  });

  facts.push({
    code: 'FAILURE_EVENT',
    observed: `Call terminated with event type "${failureEvent.event_type}" from source "${failureEvent.source ?? 'unknown'}".`,
  });

  const reason = extractFailureReason(failureEvent);
  if (reason) {
    facts.push({ code: 'FAILURE_REASON', observed: `Failure reason: ${reason}.` });
  }

  const directions = new Set(
    events.map(e => readString(e.payload, ['direction', 'metadata.direction'])).filter(Boolean)
  );
  if (directions.size > 0) {
    facts.push({ code: 'CALL_DIRECTION', observed: `Call direction: ${[...directions].join(', ')}.` });
  }

  return facts;
}

export class CallFailureExplanationService {
  constructor(private readonly repo: CallFailureExplanationRepository) {}

  async explain(callId: string, tenantId: string): Promise<CallFailureExplanation> {
    const events = await this.repo.getCallEvents(callId, tenantId);

    if (events.length === 0) {
      throw new CallNotFoundError(callId);
    }

    const timeline: ExplainEventSummary[] = events.map(e => ({
      event_type: e.event_type,
      event_time: e.event_time instanceof Date ? e.event_time.toISOString() : String(e.event_time),
      source: e.source,
    }));

    const failureEvent = events.find(isFailureEvent);

    if (!failureEvent) {
      return {
        call_id: callId,
        status: 'unavailable',
        unavailable_reason: 'not_failed',
        observed_facts: [],
        likely_cause: '',
        next_action: '',
        event_timeline: timeline,
        is_advisory: true,
        explained_at: new Date().toISOString(),
      };
    }

    const failureReason = extractFailureReason(failureEvent);
    const { cause, action } = mapToExplanation(failureReason);
    const facts = buildFacts(events, failureEvent);

    return {
      call_id: callId,
      status: 'explained',
      observed_facts: facts,
      likely_cause: cause,
      next_action: action,
      event_timeline: timeline,
      is_advisory: true,
      explained_at: new Date().toISOString(),
    };
  }
}
