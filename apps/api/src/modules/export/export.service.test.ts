import { describe, expect, it, vi } from 'vitest';
import type { ExportRepository } from './export.repository.js';
import { ExportService } from './export.service.js';

function makeMockRepo(): ExportRepository {
  return {
    exportCallEvents: vi.fn().mockResolvedValue([]),
    exportSessions: vi.fn().mockResolvedValue([]),
  } as unknown as ExportRepository;
}

describe('ExportService', () => {
  describe('exportCallEvents', () => {
    it('delegates to repository with filter', async () => {
      const repo = makeMockRepo();
      const service = new ExportService(repo);
      const filter = { since: '2026-05-01T00:00:00Z', until: '2026-05-29T00:00:00Z', limit: 100 };
      await service.exportCallEvents('tenant-1', filter);
      expect(repo.exportCallEvents).toHaveBeenCalledWith('tenant-1', filter);
    });

    it('returns call event rows', async () => {
      const repo = makeMockRepo();
      const event = { id: 'ev-1', tenant_id: 'tenant-1', call_id: 'call-1', event_type: 'call.started', event_time: new Date(), source: null, payload: {}, ingested_at: new Date() };
      vi.mocked(repo.exportCallEvents).mockResolvedValueOnce([event]);
      const service = new ExportService(repo);
      const result = await service.exportCallEvents('tenant-1', {});
      expect(result).toHaveLength(1);
      expect(result[0]?.call_id).toBe('call-1');
    });
  });

  describe('exportSessions', () => {
    it('delegates to repository with filter', async () => {
      const repo = makeMockRepo();
      const service = new ExportService(repo);
      await service.exportSessions('tenant-1', { limit: 500 });
      expect(repo.exportSessions).toHaveBeenCalledWith('tenant-1', { limit: 500 });
    });

    it('returns session rows', async () => {
      const repo = makeMockRepo();
      const session = { id: 'sess-1', call_id: 'call-1', flow_id: 'flow-1', flow_version_id: 'ver-1', status: 'completed', caller_number: '+905551234567', destination_number: '+905559876543', created_at: '2026-05-29T09:00:00Z', completed_at: '2026-05-29T09:05:00Z' };
      vi.mocked(repo.exportSessions).mockResolvedValueOnce([session]);
      const service = new ExportService(repo);
      const result = await service.exportSessions('tenant-1', {});
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('completed');
    });
  });
});
