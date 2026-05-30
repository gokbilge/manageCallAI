import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type RunningSession = {
  id: string;
  call_id: string;
  flow_id: string;
  caller_number: string | null;
  current_node_id: string | null;
  started_at: string;
};

export type QueueDepth = {
  queue_id: string;
  queue_name: string;
  member_count: number;
};

export type WebhookBacklog = {
  pending: number;
  processing: number;
  failed: number;
  abandoned: number;
};

export type LiveSnapshot = {
  tenant_id: string;
  active_session_count: number;
  running_sessions: RunningSession[];
  queue_depths: QueueDepth[];
  webhook_backlog: WebhookBacklog;
  recent_call_events_5m: number;
  recent_session_failures_1h: number;
  pending_approvals: number;
  generated_at: string;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

/** Polls the live snapshot endpoint every 5 seconds. */
export function useLiveSnapshot() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['observability-snapshot', session?.claims.tenant_id],
    queryFn: async (): Promise<LiveSnapshot> => {
      const result = await apiRequest<{ data: LiveSnapshot }>('/observability/snapshot', {
        accessToken: session?.token,
      });
      return result.data;
    },
    enabled: Boolean(session?.token),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: noRetryOnAuthError,
  });
}
