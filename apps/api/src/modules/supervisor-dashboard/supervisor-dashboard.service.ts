import type { SupervisorDashboardRepository } from './supervisor-dashboard.repository.js';
import type { DashboardView, WallboardView } from './supervisor-dashboard.types.js';

export class SupervisorDashboardService {
  constructor(private readonly repo: SupervisorDashboardRepository) {}

  async getDashboard(tenantId: string): Promise<DashboardView> {
    const [queues, agents, sla_metrics] = await Promise.all([
      this.repo.getQueueStats(tenantId),
      this.repo.getAgentSummaries(tenantId),
      this.repo.getSlaMetrics(tenantId),
    ]);
    return { queues, agents, sla_metrics, captured_at: new Date() };
  }

  async getWallboard(tenantId: string): Promise<WallboardView> {
    const [queues, agents] = await Promise.all([
      this.repo.getQueueStats(tenantId),
      this.repo.getAgentSummaries(tenantId),
    ]);

    const counts = { available: 0, busy: 0, away: 0, offline: 0 };
    for (const a of agents) {
      if (a.state === 'available') counts.available++;
      else if (a.state === 'busy') counts.busy++;
      else if (a.state === 'away' || a.state === 'wrap_up') counts.away++;
      else counts.offline++;
    }

    return {
      queues,
      agents_available: counts.available,
      agents_busy: counts.busy,
      agents_away: counts.away,
      agents_offline: counts.offline,
      captured_at: new Date(),
    };
  }
}
