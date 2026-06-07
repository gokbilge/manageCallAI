import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { SupervisorDashboardRepository } from './supervisor-dashboard.repository.js';

const TENANT = 'tenant-1';

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as Pool;
}

describe('SupervisorDashboardRepository', () => {
  it('getQueueStats returns queue statistics', async () => {
    const pool = makePool([{ queue_id: 'q-1', queue_name: 'Support', member_count: 3, pending_callbacks: 0 }]);
    const result = await new SupervisorDashboardRepository(pool).getQueueStats(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.queue_name).toBe('Support');
  });

  it('getQueueStats returns empty array when no queues', async () => {
    const pool = makePool([]);
    expect(await new SupervisorDashboardRepository(pool).getQueueStats(TENANT)).toHaveLength(0);
  });

  it('getAgentSummaries returns agent data', async () => {
    const pool = makePool([{ agent_profile_id: 'ap-1', display_name: 'Alice', state: 'available', queue_count: 2 }]);
    const result = await new SupervisorDashboardRepository(pool).getAgentSummaries(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.display_name).toBe('Alice');
  });

  it('getAgentSummaries returns empty array when no agents', async () => {
    const pool = makePool([]);
    expect(await new SupervisorDashboardRepository(pool).getAgentSummaries(TENANT)).toHaveLength(0);
  });

  it('getSlaMetrics returns SLA data for queues', async () => {
    const pool = makePool([{
      queue_id: 'q-1', queue_name: 'Support', sla_target_seconds: 60,
      pending_callbacks: 1, scheduled_callbacks: 0, reached_callbacks: 5, expired_callbacks: 0,
    }]);
    const result = await new SupervisorDashboardRepository(pool).getSlaMetrics(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.sla_target_seconds).toBe(60);
  });

  it('getSlaMetrics returns empty array when no queues', async () => {
    const pool = makePool([]);
    expect(await new SupervisorDashboardRepository(pool).getSlaMetrics(TENANT)).toHaveLength(0);
  });
});
