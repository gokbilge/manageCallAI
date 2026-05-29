import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type RuntimeSessionStatus = 'running' | 'completed' | 'failed';

export type RuntimeSession = {
  id: string;
  call_id: string;
  flow_id: string;
  flow_version_id?: string;
  status: RuntimeSessionStatus;
  current_node_id: string | null;
  caller_number: string | null;
  destination_number?: string | null;
  created_at: string;
  completed_at: string | null;
};

export type RuntimeSessionStep = {
  id: string;
  step_index: number;
  phase: 'start' | 'advance';
  node_id: string | null;
  outcome: 'start' | 'completed' | 'digits' | 'timeout' | 'invalid';
  digits: string | null;
  action_json: Record<string, unknown> | null;
  resulting_node_id: string | null;
  resulting_status: RuntimeSessionStatus;
  variables_json: Record<string, string>;
  created_at: string;
};

export type RuntimeSessionReplay = {
  session: RuntimeSession;
  steps: RuntimeSessionStep[];
  call_events: Array<{
    id: string;
    call_id: string;
    event_type: string;
    event_time: string;
    source: string | null;
    payload: Record<string, unknown>;
    ingested_at: string;
  }>;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useRuntimeSessions(status?: RuntimeSessionStatus) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['runtime-sessions', session?.claims.tenant_id, status ?? 'all'],
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
    queryFn: async () => {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const result = await apiRequest<{ data: RuntimeSession[] }>(`/runtime/ivr/sessions${query}`, {
        accessToken: session?.token,
      });
      return result.data;
    },
  });
}

export function useRuntimeSessionReplay(sessionId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['runtime-session-replay', sessionId],
    enabled: Boolean(session?.token && sessionId),
    retry: noRetryOnAuthError,
    queryFn: async () => {
      const result = await apiRequest<{ data: RuntimeSessionReplay }>(`/runtime/ivr/sessions/${sessionId}`, {
        accessToken: session?.token,
      });
      return result.data;
    },
  });
}
