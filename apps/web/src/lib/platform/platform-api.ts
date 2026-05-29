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

export type PlatformRuntimeSummary = {
  active_sessions: number;
  completed_sessions_24h: number;
  failed_sessions_24h: number;
  call_events_24h: number;
  failed_runtime_ingestions_24h: number;
  pending_approvals: number;
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

export function usePlatformRuntimeSummary() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['platform-runtime-summary'],
    queryFn: async () => {
      const result = await apiRequest<{ data: PlatformRuntimeSummary }>('/platform/runtime/summary', {
        accessToken: session?.token,
      });
      return result.data;
    },
    enabled: Boolean(session?.token),
    refetchInterval: 30_000,
    retry: noRetryOnAuthError,
  });
}
