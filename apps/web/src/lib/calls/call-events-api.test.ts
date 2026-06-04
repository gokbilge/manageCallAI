import { describe, expect, it } from 'vitest';
import { buildCallSummaries, type CallEvent } from './call-events-api';

function makeEvent(overrides: Partial<CallEvent>): CallEvent {
  return {
    id: overrides.id ?? 'event-id',
    tenant_id: overrides.tenant_id ?? 'tenant-1',
    call_id: overrides.call_id ?? 'call-1',
    event_type: overrides.event_type ?? 'channel_create',
    event_time: overrides.event_time ?? '2026-06-04T12:00:00.000Z',
    source: overrides.source ?? 'freeswitch-agent',
    payload: overrides.payload ?? {},
    ingested_at: overrides.ingested_at ?? '2026-06-04T12:00:01.000Z',
  };
}

describe('buildCallSummaries', () => {
  it('groups events by call and sorts newest calls first', () => {
    const summaries = buildCallSummaries([
      makeEvent({ id: 'a', call_id: 'call-older', event_time: '2026-06-04T10:00:00.000Z' }),
      makeEvent({ id: 'b', call_id: 'call-newer', event_time: '2026-06-04T11:00:00.000Z' }),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]?.call_id).toBe('call-newer');
    expect(summaries[1]?.call_id).toBe('call-older');
  });

  it('derives outbound completed call details from payload fields', () => {
    const summaries = buildCallSummaries([
      makeEvent({
        id: 'a',
        call_id: 'call-1',
        event_type: 'outbound_call_dispatched',
        event_time: '2026-06-04T10:00:00.000Z',
        payload: { direction: 'outbound', from_number: '1001', to_number: '+12125550100' },
      }),
      makeEvent({
        id: 'b',
        call_id: 'call-1',
        event_type: 'outbound_call_completed',
        event_time: '2026-06-04T10:03:00.000Z',
        payload: { final_disposition: 'completed' },
      }),
    ]);

    expect(summaries[0]).toMatchObject({
      call_id: 'call-1',
      direction: 'outbound',
      status: 'completed',
      from_number: '1001',
      to_number: '+12125550100',
      counterpart: '+12125550100',
      event_count: 2,
      last_event_type: 'outbound_call_completed',
    });
  });

  it('marks failed calls and keeps the failure reason', () => {
    const summaries = buildCallSummaries([
      makeEvent({
        id: 'a',
        call_id: 'call-failed',
        event_type: 'outbound_call_dispatched',
        payload: { direction: 'outbound', to_number: '+441234567890' },
      }),
      makeEvent({
        id: 'b',
        call_id: 'call-failed',
        event_type: 'outbound_call_failed',
        event_time: '2026-06-04T12:01:00.000Z',
        payload: { failure_reason: 'busy' },
      }),
    ]);

    expect(summaries[0]?.status).toBe('failed');
    expect(summaries[0]?.failure_reason).toBe('busy');
    expect(summaries[0]?.ended_at).toBe('2026-06-04T12:01:00.000Z');
  });

  it('reads nested metadata for inbound calls', () => {
    const summaries = buildCallSummaries([
      makeEvent({
        id: 'a',
        call_id: 'call-2',
        payload: {
          metadata: {
            direction: 'inbound',
            from: '+4989123456',
            to: '2001',
          },
        },
      }),
    ]);

    expect(summaries[0]).toMatchObject({
      direction: 'inbound',
      from_number: '+4989123456',
      to_number: '2001',
      counterpart: '+4989123456',
      status: 'active',
    });
  });

  it('treats non-normal hangup causes as failures', () => {
    const summaries = buildCallSummaries([
      makeEvent({
        id: 'a',
        call_id: 'call-3',
        event_type: 'channel_hangup',
        payload: { hangup_cause: 'NO_ANSWER' },
      }),
    ]);

    expect(summaries[0]?.status).toBe('failed');
    expect(summaries[0]?.failure_reason).toBe('NO_ANSWER');
  });
});
