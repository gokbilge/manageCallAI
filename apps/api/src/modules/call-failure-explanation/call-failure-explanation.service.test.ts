import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallFailureExplanationRepository } from './call-failure-explanation.repository.js';
import { CallFailureExplanationService, CallNotFoundError } from './call-failure-explanation.service.js';

vi.mock('./call-failure-explanation.repository.js');

const repo = vi.mocked(new CallFailureExplanationRepository({} as never));
const service = new CallFailureExplanationService(repo);

const CALL_ID = 'test-call-001';
const TENANT_ID = 'tenant-1';

const makeEvent = (overrides: Partial<{
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
}> = {}) => ({
  call_id: CALL_ID,
  event_type: 'CHANNEL_ANSWER',
  event_time: new Date('2026-06-05T10:00:00Z'),
  source: 'freeswitch',
  payload: {},
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.getCallEvents.mockResolvedValue([makeEvent()]);
});

describe('CallFailureExplanationService', () => {
  describe('fail-closed: no events', () => {
    it('throws CallNotFoundError when no events exist', async () => {
      repo.getCallEvents.mockResolvedValue([]);
      await expect(service.explain(CALL_ID, TENANT_ID)).rejects.toThrow(CallNotFoundError);
    });

    it('error message includes the call_id', async () => {
      repo.getCallEvents.mockResolvedValue([]);
      const err = await service.explain(CALL_ID, TENANT_ID).catch(e => e);
      expect(err.message).toContain(CALL_ID);
    });
  });

  describe('not_failed path', () => {
    it('returns unavailable with not_failed reason when no failure event', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_ANSWER' }),
        makeEvent({ event_type: 'CHANNEL_BRIDGE' }),
        makeEvent({ event_type: 'CHANNEL_HANGUP_COMPLETE', payload: { 'Hangup-Cause': 'NORMAL_CLEARING' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('unavailable');
      expect(result.unavailable_reason).toBe('not_failed');
    });

    it('ORIGINATOR_CANCEL is treated as normal, not a failure', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_HANGUP_COMPLETE', payload: { 'Hangup-Cause': 'ORIGINATOR_CANCEL' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('unavailable');
      expect(result.unavailable_reason).toBe('not_failed');
    });

    it('returns event_timeline even for unavailable calls', async () => {
      repo.getCallEvents.mockResolvedValue([makeEvent({ event_type: 'CHANNEL_ANSWER' })]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.event_timeline).toHaveLength(1);
      expect(result.event_timeline[0]!.event_type).toBe('CHANNEL_ANSWER');
    });
  });

  describe('explained path: outbound_call_failed', () => {
    it('detects outbound_call_failed event', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'NO_ROUTE_FOR_PREFIX' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('explained');
    });

    it('maps NO_ROUTE_FOR_PREFIX to a route guidance message', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'NO_ROUTE_FOR_PREFIX' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.likely_cause).toContain('outbound route');
      expect(result.next_action).toContain('outbound route');
    });

    it('maps TRUNK_NOT_REGISTERED to registration guidance', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'TRUNK_NOT_REGISTERED' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.likely_cause).toContain('SIP trunk');
    });

    it('maps USER_BUSY to busy message', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'USER_BUSY' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.likely_cause).toContain('busy');
    });

    it('maps NO_ANSWER to no-answer message', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'NO_ANSWER' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.likely_cause).toContain('answer');
    });

    it('handles unknown failure reason gracefully', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'SOME_UNKNOWN_CODE' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('explained');
      expect(result.likely_cause).toContain('SOME_UNKNOWN_CODE');
    });

    it('handles missing failure reason in payload', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: {} }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('explained');
      expect(result.likely_cause).toBeTruthy();
    });
  });

  describe('explained path: CHANNEL_HANGUP_COMPLETE with failure cause', () => {
    it('detects NO_ROUTE_DESTINATION hangup cause as failure', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_HANGUP_COMPLETE', payload: { 'Hangup-Cause': 'NO_ROUTE_DESTINATION' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('explained');
    });

    it('detects CALL_REJECTED hangup cause as failure', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_HANGUP_COMPLETE', payload: { 'Hangup-Cause': 'CALL_REJECTED' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('explained');
      expect(result.likely_cause).toContain('rejected');
    });

    it('detects HangupCause (camelCase) variant', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_HANGUP_COMPLETE', payload: { HangupCause: 'USER_BUSY' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.status).toBe('explained');
    });
  });

  describe('observed facts', () => {
    it('includes EVENT_COUNT fact', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_ANSWER' }),
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'USER_BUSY' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.observed_facts.some(f => f.code === 'EVENT_COUNT')).toBe(true);
    });

    it('includes FAILURE_EVENT fact', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'USER_BUSY' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.observed_facts.some(f => f.code === 'FAILURE_EVENT')).toBe(true);
    });

    it('includes FAILURE_REASON fact when reason is present', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: { failure_reason: 'USER_BUSY' } }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      const reasonFact = result.observed_facts.find(f => f.code === 'FAILURE_REASON');
      expect(reasonFact).toBeDefined();
      expect(reasonFact?.observed).toContain('USER_BUSY');
    });

    it('omits FAILURE_REASON fact when no reason in payload', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: {} }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.observed_facts.some(f => f.code === 'FAILURE_REASON')).toBe(false);
    });
  });

  describe('result shape', () => {
    it('always sets is_advisory to true', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: {} }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.is_advisory).toBe(true);
    });

    it('includes call_id in result', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'outbound_call_failed', payload: {} }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.call_id).toBe(CALL_ID);
    });

    it('event_timeline is in chronological order', async () => {
      repo.getCallEvents.mockResolvedValue([
        makeEvent({ event_type: 'CHANNEL_ANSWER', event_time: new Date('2026-06-05T10:00:00Z') }),
        makeEvent({ event_type: 'outbound_call_failed', event_time: new Date('2026-06-05T10:00:05Z'), payload: {} }),
      ]);
      const result = await service.explain(CALL_ID, TENANT_ID);
      expect(result.event_timeline[0]!.event_type).toBe('CHANNEL_ANSWER');
      expect(result.event_timeline[1]!.event_type).toBe('outbound_call_failed');
    });

    it('passes call through repository with correct tenant scoping', async () => {
      repo.getCallEvents.mockResolvedValue([makeEvent({ event_type: 'outbound_call_failed', payload: {} })]);
      await service.explain(CALL_ID, TENANT_ID);
      expect(repo.getCallEvents).toHaveBeenCalledWith(CALL_ID, TENANT_ID);
    });
  });
});
