import type { PlatformHealthSnapshot } from '@managecallai/contracts';
import type { ObservabilityRepository } from './observability.repository.js';
import type { LiveSnapshot } from './observability.types.js';

const HEALTH_TIMEOUT_MS = 3000;

export class ObservabilityService {
  constructor(private readonly repo: ObservabilityRepository) {}

  getSnapshot(tenantId: string): Promise<LiveSnapshot> {
    return this.repo.getSnapshot(tenantId);
  }

  async getPlatformHealth(
    checks: Array<{ name: string; url: string }>,
  ): Promise<PlatformHealthSnapshot> {
    const [services, summary] = await Promise.all([
      Promise.all(checks.map(checkService)),
      this.repo.getPlatformRuntimeSummary(),
    ]);
    return {
      services,
      active_sessions_total: summary.active_sessions,
      completed_sessions_24h: summary.completed_sessions_24h,
      failed_sessions_24h: summary.failed_sessions_24h,
      generated_at: new Date().toISOString(),
    };
  }
}

async function checkService({ name, url }: { name: string; url: string }) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    const detail = (await response.text()).slice(0, 200);
    return { name, url, status: (response.ok ? 'healthy' : 'degraded') as 'healthy' | 'degraded' | 'unreachable', detail };
  } catch {
    clearTimeout(id);
    return { name, url, status: 'unreachable' as const, detail: 'connection failed' };
  }
}
