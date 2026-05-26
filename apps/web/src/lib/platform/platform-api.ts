import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  directory_domain: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PlatformServiceHealth = {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  detail: string;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return false;
  }
  return failureCount < 1;
}

export function usePlatformTenants() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const result = await apiRequest<{ data: TenantSummary[] }>('/platform/tenants', {
        accessToken: session?.token,
      });
      return result.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function usePlatformRuntimeHealth() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['platform-runtime-health-backend'],
    queryFn: async () => {
      const result = await apiRequest<{ data: { services: PlatformServiceHealth[] } }>(
        '/platform/runtime/health',
        { accessToken: session?.token },
      );
      return result.data.services;
    },
    enabled: Boolean(session?.token),
    refetchInterval: 30_000,
    retry: noRetryOnAuthError,
  });
}
