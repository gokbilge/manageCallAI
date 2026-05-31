import { config } from '../../config/env.js';
import type { PlatformRepository } from './platform.repository.js';
import type { PlatformRuntimeSummary, RuntimeHealthSummary, ServiceHealth, TenantSummary } from './platform.types.js';

const HEALTH_TIMEOUT_MS = 3000;

export class PlatformService {
  constructor(private readonly repo: PlatformRepository) {}

  listTenants(): Promise<TenantSummary[]> {
    return this.repo.listTenants();
  }

  runtimeSummary(): Promise<PlatformRuntimeSummary> {
    return this.repo.getRuntimeSummary();
  }

  async runtimeHealth(): Promise<RuntimeHealthSummary> {
    const checks = [
      { name: 'api', url: config.platformApiHealthUrl },
      { name: 'worker', url: config.platformWorkerHealthUrl },
      { name: 'freeswitch-agent', url: config.platformFreeswitchAgentHealthUrl },
    ];
    const services = await Promise.all(checks.map(checkService));
    return { services };
  }
}

async function checkService({ name, url }: { name: string; url: string }): Promise<ServiceHealth> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const detail = (await response.text()).slice(0, 200);
    return { name, url, status: response.ok ? 'healthy' : 'degraded', detail };
  } catch {
    clearTimeout(timeoutId);
    return { name, url, status: 'unreachable', detail: 'connection failed' };
  }
}
