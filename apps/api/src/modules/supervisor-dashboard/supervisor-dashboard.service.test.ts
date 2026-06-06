import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupervisorDashboardRepository } from './supervisor-dashboard.repository.js';
import type { AgentSummary, QueueStat, SlaMetric } from './supervisor-dashboard.types.js';
import { SupervisorDashboardService } from './supervisor-dashboard.service.js';

const TENANT = 'tenant-1';

const baseQueue: QueueStat = {
  queue_id: 'q-1',
  queue_name: 'Support',
  strategy: 'sequential',
  status: 'active',
  member_count: 3,
  sla_target_seconds: 60,
  pending_callbacks: 2,
};

const baseAgent: AgentSummary = {
  agent_profile_id: 'ap-1',
  display_name: 'Alice',
  state: 'available',
  reason: null,
  queue_count: 1,
};

const baseSla: SlaMetric = {
  queue_id: 'q-1',
  queue_name: 'Support',
  sla_target_seconds: 60,
  pending_callbacks: 2,
  scheduled_callbacks: 1,
  reached_callbacks: 5,
  expired_callbacks: 0,
};

function makeRepo(overrides: Partial<SupervisorDashboardRepository> = {}): SupervisorDashboardRepository {
  return {
    getQueueStats: vi.fn().mockResolvedValue([baseQueue]),
    getAgentSummaries: vi.fn().mockResolvedValue([baseAgent]),
    getSlaMetrics: vi.fn().mockResolvedValue([baseSla]),
    ...overrides,
  } as unknown as SupervisorDashboardRepository;
}

describe('SupervisorDashboardService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SupervisorDashboardService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SupervisorDashboardService(repo);
  });

  it('getDashboard returns queues, agents, and sla_metrics', async () => {
    const dashboard = await service.getDashboard(TENANT);
    expect(dashboard.queues).toHaveLength(1);
    expect(dashboard.agents).toHaveLength(1);
    expect(dashboard.sla_metrics).toHaveLength(1);
    expect(dashboard.captured_at).toBeInstanceOf(Date);
  });

  it('getWallboard returns queue stats and agent state counts', async () => {
    const wall = await service.getWallboard(TENANT);
    expect(wall.queues).toHaveLength(1);
    expect(wall.agents_available).toBe(1);
    expect(wall.agents_busy).toBe(0);
    expect(wall.agents_away).toBe(0);
    expect(wall.agents_offline).toBe(0);
  });

  it('getWallboard counts wrap_up in away bucket', async () => {
    repo = makeRepo({
      getAgentSummaries: vi.fn().mockResolvedValue([
        { ...baseAgent, state: 'wrap_up' },
      ]),
    });
    service = new SupervisorDashboardService(repo);
    const wall = await service.getWallboard(TENANT);
    expect(wall.agents_away).toBe(1);
    expect(wall.agents_available).toBe(0);
  });

  it('getWallboard counts null state as offline', async () => {
    repo = makeRepo({
      getAgentSummaries: vi.fn().mockResolvedValue([
        { ...baseAgent, state: null },
      ]),
    });
    service = new SupervisorDashboardService(repo);
    const wall = await service.getWallboard(TENANT);
    expect(wall.agents_offline).toBe(1);
  });
});
