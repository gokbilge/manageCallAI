import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type CallEvent = {
  id: string;
  tenant_id: string;
  call_id: string;
  event_type: string;
  event_time: string;
  source: string | null;
  payload: Record<string, unknown>;
  ingested_at: string;
};

export type CallDirection = 'inbound' | 'outbound' | 'unknown';
export type CallStatus = 'active' | 'completed' | 'failed';

export type CallSummary = {
  call_id: string;
  direction: CallDirection;
  status: CallStatus;
  from_number: string | null;
  to_number: string | null;
  counterpart: string | null;
  started_at: string;
  last_event_at: string;
  ended_at: string | null;
  last_event_type: string;
  failure_reason: string | null;
  source: string | null;
  event_count: number;
  events: CallEvent[];
};

type CallEventsOptions = {
  refetchInterval?: number | false;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useCallEvents(options: CallEventsOptions = {}) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['call-events', session?.claims.tenant_id, options.refetchInterval ?? 'default'],
    queryFn: async () => {
      const result = await apiRequest<{ data: CallEvent[] }>('/call-events', {
        accessToken: session?.token,
      });
      return result.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
    refetchInterval: options.refetchInterval,
  });
}

export function useCallSummaries(options: CallEventsOptions = {}) {
  const query = useCallEvents(options);
  const summaries = useMemo(() => buildCallSummaries(query.data ?? []), [query.data]);
  return { ...query, summaries };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNestedString(record: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = record;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return readString(current);
}

function readDirection(event: CallEvent): CallDirection {
  const payloadDirection =
    readNestedString(event.payload, ['direction']) ??
    readNestedString(event.payload, ['metadata', 'direction']);

  if (payloadDirection === 'inbound' || payloadDirection === 'outbound') {
    return payloadDirection;
  }
  if (event.event_type.startsWith('outbound_')) {
    return 'outbound';
  }
  return 'unknown';
}

function readPhone(record: Record<string, unknown>, candidates: string[][]): string | null {
  for (const path of candidates) {
    const value = readNestedString(record, path);
    if (value) return value;
  }
  return null;
}

function extractFromNumber(event: CallEvent): string | null {
  return readPhone(event.payload, [
    ['from_number'],
    ['from'],
    ['caller_number'],
    ['metadata', 'from_number'],
    ['metadata', 'from'],
    ['metadata', 'caller_number'],
  ]);
}

function extractToNumber(event: CallEvent): string | null {
  return readPhone(event.payload, [
    ['to_number'],
    ['to'],
    ['destination_number'],
    ['metadata', 'to_number'],
    ['metadata', 'to'],
    ['metadata', 'destination_number'],
  ]);
}

function isCompletionEvent(event: CallEvent): boolean {
  return (
    event.event_type === 'call.completed' ||
    event.event_type === 'outbound_call_completed' ||
    event.event_type === 'channel_hangup'
  );
}

function extractFailureReason(event: CallEvent): string | null {
  return (
    readNestedString(event.payload, ['failure_reason']) ??
    readNestedString(event.payload, ['hangup_cause']) ??
    readNestedString(event.payload, ['final_disposition']) ??
    readNestedString(event.payload, ['disposition']) ??
    readNestedString(event.payload, ['metadata', 'failure_reason']) ??
    readNestedString(event.payload, ['metadata', 'hangup_cause']) ??
    readNestedString(event.payload, ['metadata', 'final_disposition']) ??
    null
  );
}

function isFailureEvent(event: CallEvent): boolean {
  if (event.event_type.includes('failed')) return true;

  const reason = extractFailureReason(event)?.toUpperCase();
  if (!reason) return false;

  return !['NORMAL_CLEARING', 'ANSWERED', 'COMPLETED', 'SUCCESS'].includes(reason);
}

function compareIsoAsc(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

export function buildCallSummaries(events: CallEvent[]): CallSummary[] {
  const grouped = new Map<string, CallEvent[]>();

  for (const event of events) {
    const bucket = grouped.get(event.call_id);
    if (bucket) {
      bucket.push(event);
    } else {
      grouped.set(event.call_id, [event]);
    }
  }

  return [...grouped.values()]
    .map((group): CallSummary => {
      const ordered = [...group].sort((left, right) => compareIsoAsc(left.event_time, right.event_time));
      const first = ordered[0]!;
      const last = ordered[ordered.length - 1]!;
      const direction = ordered.map(readDirection).find(value => value !== 'unknown') ?? 'unknown';
      const fromNumber = ordered.map(extractFromNumber).find(Boolean) ?? null;
      const toNumber = ordered.map(extractToNumber).find(Boolean) ?? null;
      const failedEvent = [...ordered].reverse().find(isFailureEvent) ?? null;
      const completed = ordered.some(isCompletionEvent);
      const status: CallStatus = failedEvent ? 'failed' : completed ? 'completed' : 'active';

      return {
        call_id: first.call_id,
        direction,
        status,
        from_number: fromNumber,
        to_number: toNumber,
        counterpart: direction === 'outbound' ? toNumber : fromNumber,
        started_at: first.event_time,
        last_event_at: last.event_time,
        ended_at: status === 'active' ? null : last.event_time,
        last_event_type: last.event_type,
        failure_reason: failedEvent ? extractFailureReason(failedEvent) : null,
        source: last.source ?? first.source ?? null,
        event_count: ordered.length,
        events: ordered,
      };
    })
    .sort((left, right) => compareIsoAsc(right.last_event_at, left.last_event_at));
}
