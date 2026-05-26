import { useQuery } from '@tanstack/react-query';

export type ServiceStatus = 'healthy' | 'unreachable';

export type ServiceHealth = {
  name: string;
  baseUrl: string;
  status: ServiceStatus;
  detail: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const workerBaseUrl = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://localhost:3400';

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export function useRuntimeHealth() {
  return useQuery({
    queryKey: ['platform-runtime-health'],
    queryFn: async (): Promise<ServiceHealth[]> => {
      const checks = await Promise.allSettled([
        fetchJson(`${apiBaseUrl.replace(/\/api\/v1$/, '')}/health`),
        fetchJson(`${workerBaseUrl}/health`),
      ]);

      return [
        mapCheck('API', apiBaseUrl, checks[0]),
        mapCheck('Worker', workerBaseUrl, checks[1]),
      ];
    },
    refetchInterval: 30_000,
  });
}

function mapCheck(
  name: string,
  baseUrl: string,
  result: PromiseSettledResult<Record<string, unknown>>,
): ServiceHealth {
  if (result.status === 'fulfilled') {
    const detail =
      name === 'API'
        ? `${String(result.value.status ?? 'unknown')} / db=${String(result.value.db ?? 'unknown')}`
        : String(result.value.status ?? 'ok');

    return {
      name,
      baseUrl,
      status: 'healthy',
      detail,
    };
  }

  return {
    name,
    baseUrl,
    status: 'unreachable',
    detail: result.reason instanceof Error ? result.reason.message : 'Unknown failure',
  };
}
