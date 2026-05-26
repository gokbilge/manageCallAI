import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type FlowVersionState =
  | 'draft'
  | 'validated'
  | 'simulated'
  | 'published'
  | 'superseded'
  | 'rolled_back';

export type FlowVersion = {
  id: string;
  flow_id: string;
  version_number: number;
  state: FlowVersionState;
  definition: Record<string, unknown>;
  created_at: string;
  validated_at: string | null;
  published_at: string | null;
};

export type IvrFlow = {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'inactive';
  draft_version_id: string | null;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IvrFlowWithVersions = IvrFlow & { versions: FlowVersion[] };

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useIvrFlows() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['ivr-flows'],
    queryFn: async () => {
      const r = await apiRequest<{ data: IvrFlow[] }>('/ivr-flows', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useIvrFlow(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['ivr-flows', id],
    queryFn: async () => {
      const r = await apiRequest<{ data: IvrFlowWithVersions }>(`/ivr-flows/${id}`, { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token && id),
    retry: noRetryOnAuthError,
  });
}

export function useCreateIvrFlow() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string; definition: Record<string, unknown> }) => {
      const r = await apiRequest<{ data: IvrFlowWithVersions }>('/ivr-flows', {
        method: 'POST',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ivr-flows'] }); },
  });
}

export function useValidateFlowVersion(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const r = await apiRequest<{ data: { version: FlowVersion; outcome: { status: string; errors: unknown[] } } }>(
        `/ivr-flows/${flowId}/versions/${versionId}/validate`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] }); },
  });
}

export function usePublishFlowVersion(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const r = await apiRequest<{ data: IvrFlow }>(
        `/ivr-flows/${flowId}/versions/${versionId}/publish`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ivr-flows'] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] });
    },
  });
}

export function useRollbackFlow(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiRequest<{ data: IvrFlow }>(
        `/ivr-flows/${flowId}/rollback`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ivr-flows'] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] });
    },
  });
}
