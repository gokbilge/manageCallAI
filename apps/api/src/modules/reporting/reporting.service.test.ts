import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportingRepository } from './reporting.repository.js';
import { NlReportingService, NlQueryNotSupportedError } from './reporting.service.js';

vi.mock('./reporting.repository.js');

const repo = vi.mocked(new ReportingRepository({} as never));
const service = new NlReportingService(repo);

const sampleRow = { call_id: 'c-1', event_type: 'outbound_call_completed', event_time: '2026-06-05T10:00:00Z', source: 'freeswitch' };

beforeEach(() => {
  vi.clearAllMocks();
  repo.queryCallEvents.mockResolvedValue([sampleRow]);
  repo.countCallEvents.mockResolvedValue(1);
});

describe('NlReportingService', () => {
  describe('unsupported questions — fail closed', () => {
    it('rejects a question with no call terms', async () => {
      await expect(service.query('what is the weather?', 'tenant-1'))
        .rejects.toThrow(NlQueryNotSupportedError);
    });

    it('rejects SQL injection attempt', async () => {
      await expect(service.query('SELECT * FROM tenants', 'tenant-1'))
        .rejects.toThrow(NlQueryNotSupportedError);
    });

    it('rejects question about unrelated domain', async () => {
      await expect(service.query('show me all users', 'tenant-1'))
        .rejects.toThrow(NlQueryNotSupportedError);
    });

    it('includes supported examples in the error', async () => {
      const err = await service.query('what is 2 + 2', 'tenant-1').catch(e => e);
      expect(err).toBeInstanceOf(NlQueryNotSupportedError);
      expect((err as NlQueryNotSupportedError).supportedExamples.length).toBeGreaterThan(0);
    });
  });

  describe('direction parsing', () => {
    it('extracts outbound direction', async () => {
      const result = await service.query('show outbound calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'direction', value: 'outbound' });
      expect(repo.queryCallEvents).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ direction: 'outbound' }));
    });

    it('extracts inbound direction', async () => {
      const result = await service.query('show inbound calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'direction', value: 'inbound' });
    });

    it('no direction filter for generic calls', async () => {
      const result = await service.query('show calls', 'tenant-1');
      expect(result.applied_filters.every(f => f.dimension !== 'direction')).toBe(true);
    });
  });

  describe('status parsing', () => {
    it('extracts failed status', async () => {
      const result = await service.query('show failed calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'status', value: 'failed' });
    });

    it('extracts completed status', async () => {
      const result = await service.query('show completed calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'status', value: 'completed' });
    });

    it('extracts active status from ongoing keyword', async () => {
      const result = await service.query('show ongoing calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'status', value: 'active' });
    });

    it('extracts active status from answered keyword', async () => {
      const result = await service.query('show answered calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'status', value: 'active' });
    });
  });

  describe('time range parsing', () => {
    it('extracts last_hour range', async () => {
      const result = await service.query('show calls last hour', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'last_hour' });
    });

    it('extracts today range', async () => {
      const result = await service.query('show calls today', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'today' });
    });

    it('extracts yesterday range', async () => {
      const result = await service.query('show calls yesterday', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'yesterday' });
    });

    it('extracts last_7_days from last week', async () => {
      const result = await service.query('show calls last week', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'last_7_days' });
    });

    it('extracts last_7_days from past week', async () => {
      const result = await service.query('show calls past week', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'last_7_days' });
    });

    it('uses default 24h window when no time range', async () => {
      const result = await service.query('show calls', 'tenant-1');
      expect(result.explanation).toContain('last 24 hours');
    });
  });

  describe('aggregation mode', () => {
    it('returns count-only for "how many" questions', async () => {
      const result = await service.query('how many calls failed today', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'aggregation', value: 'count' });
      expect(repo.countCallEvents).toHaveBeenCalled();
      expect(result.results).toHaveLength(0);
    });

    it('returns count-only for "count" keyword', async () => {
      const result = await service.query('count inbound calls', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'aggregation', value: 'count' });
    });

    it('returns count-only for "total" keyword', async () => {
      const result = await service.query('total calls last hour', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'aggregation', value: 'count' });
    });

    it('returns list for non-count questions', async () => {
      const result = await service.query('show outbound calls today', 'tenant-1');
      expect(result.results).toHaveLength(1);
      expect(repo.queryCallEvents).toHaveBeenCalled();
    });
  });

  describe('combined filters', () => {
    it('combines direction + status + time range', async () => {
      const result = await service.query('show failed outbound calls today', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'direction', value: 'outbound' });
      expect(result.applied_filters).toContainEqual({ dimension: 'status', value: 'failed' });
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'today' });
    });

    it('combines count + direction + time range', async () => {
      const result = await service.query('how many outbound calls last week', 'tenant-1');
      expect(result.applied_filters).toContainEqual({ dimension: 'direction', value: 'outbound' });
      expect(result.applied_filters).toContainEqual({ dimension: 'time_range', value: 'last_7_days' });
      expect(result.applied_filters).toContainEqual({ dimension: 'aggregation', value: 'count' });
    });
  });

  describe('result shape', () => {
    it('always sets is_advisory to true', async () => {
      const result = await service.query('show calls', 'tenant-1');
      expect(result.is_advisory).toBe(true);
    });

    it('includes the original question', async () => {
      const result = await service.query('show inbound calls today', 'tenant-1');
      expect(result.question).toBe('show inbound calls today');
    });

    it('includes explanation text', async () => {
      const result = await service.query('show failed calls today', 'tenant-1');
      expect(result.explanation).toBeTruthy();
      expect(result.explanation).toContain('failed');
      expect(result.explanation).toContain('today');
    });

    it('count explanation includes the count', async () => {
      repo.countCallEvents.mockResolvedValue(42);
      const result = await service.query('how many calls', 'tenant-1');
      expect(result.explanation).toContain('42');
      expect(result.result_count).toBe(42);
    });
  });
});
