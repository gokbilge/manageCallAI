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
  graph_json: Record<string, unknown>;
  created_at: string;
  validated_at: string | null;
  simulated_at: string | null;
  published_at: string | null;
  metadata: Record<string, unknown>;
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

export type PromptAssetOption = {
  id: string;
  name: string;
  language: string | null;
  status: 'active' | 'inactive';
  storage_uri: string | null;
};

export type ExtensionOption = {
  id: string;
  extension_number: string;
  display_name: string;
  status: 'active' | 'inactive';
};

export type ScheduleOption = {
  id: string;
  name: string;
  timezone: string;
  status: 'active' | 'inactive';
};

export type QueueOption = {
  id: string;
  name: string;
  strategy: 'simultaneous' | 'sequential';
  status: 'active' | 'inactive';
};

export type VoicemailBoxOption = {
  id: string;
  name: string;
  mailbox_number: string;
  status: 'active' | 'inactive';
};

export type FlowValidationResponse = {
  version: FlowVersion;
  outcome: { status: string; errors: unknown[]; warnings: unknown[] };
};

export type FlowSimulationResponse = {
  version: FlowVersion;
  scenario: {
    digits?: string[];
    collected_digits?: Record<string, string>;
    caller_number?: string;
    now?: string;
    force_timeout?: boolean;
    force_timeout_nodes?: string[];
    force_invalid?: boolean;
    force_invalid_nodes?: string[];
    variables?: Record<string, string>;
  };
  outcome: {
    status: string;
    path: string[];
    steps: Array<{ node_id: string; category: 'start' | 'task' | 'gateway' | 'end'; edge_id?: string }>;
    final_action: Record<string, unknown> | null;
    errors: unknown[];
  };
};

export type FlowPublishResponse = {
  status: 'published' | 'pending_approval';
  flow: IvrFlow;
  approval_request_id?: string;
};

export type FlowHistory = {
  validations: Array<{
    id: string;
    version_id: string | null;
    validator_version: string | null;
    status: 'passed' | 'failed' | 'warning_only';
    errors: unknown[];
    warnings: unknown[];
    created_at: string;
  }>;
  simulations: Array<{
    id: string;
    version_id: string | null;
    scenario: Record<string, unknown>;
    status: 'passed' | 'failed' | 'inconclusive';
    result_payload: Record<string, unknown>;
    created_at: string;
  }>;
  publishes: Array<{
    id: string;
    version_id: string | null;
    action_type: 'publish' | 'rollback';
    triggered_by_type: 'user' | 'workflow' | 'ai_agent' | 'system';
    triggered_by_id: string | null;
    approval_request_id: string | null;
    approval_status: 'pending' | 'approved' | 'rejected' | 'expired' | null;
    decision_at: string | null;
    result: 'success' | 'failed' | 'pending_approval';
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
  audits: Array<{
    id: string;
    actor_type: 'user' | 'workflow' | 'ai_agent' | 'system';
    actor_id: string | null;
    action: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
};

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
    mutationFn: async (body: { name: string; description?: string; graph_json?: Record<string, unknown> }) => {
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

export function useFlowVersions(flowId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['ivr-flows', flowId, 'versions'],
    queryFn: async () => {
      const r = await apiRequest<{ data: FlowVersion[] }>(`/ivr-flows/${flowId}/versions`, { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token && flowId),
    retry: noRetryOnAuthError,
  });
}

export function useFlowHistory(flowId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['ivr-flows', flowId, 'history'],
    queryFn: async () => {
      const r = await apiRequest<{ data: FlowHistory }>(`/ivr-flows/${flowId}/history`, { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token && flowId),
    retry: noRetryOnAuthError,
  });
}

export function useUpdateFlowVersion(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { versionId: string; graph_json: Record<string, unknown> }) => {
      const r = await apiRequest<{ data: FlowVersion }>(
        `/ivr-flows/${flowId}/versions/${input.versionId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ graph_json: input.graph_json }),
          accessToken: session?.token,
        },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId, 'versions'] });
    },
  });
}

export function usePromptAssetOptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['prompts', 'options'],
    queryFn: async () => {
      const r = await apiRequest<{ data: PromptAssetOption[] }>('/prompts', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useExtensionOptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['extensions', 'options'],
    queryFn: async () => {
      const r = await apiRequest<{ data: ExtensionOption[] }>('/extensions', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useScheduleOptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['schedules', 'options'],
    queryFn: async () => {
      const r = await apiRequest<{ data: ScheduleOption[] }>('/schedules', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useQueueOptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['queues', 'options'],
    queryFn: async () => {
      const r = await apiRequest<{ data: QueueOption[] }>('/queues', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useVoicemailBoxOptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['voicemail-boxes', 'options'],
    queryFn: async () => {
      const r = await apiRequest<{ data: VoicemailBoxOption[] }>('/voicemail-boxes', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useValidateFlowVersion(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const r = await apiRequest<{ data: FlowValidationResponse }>(
        `/ivr-flows/${flowId}/versions/${versionId}/validate`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] }); },
  });
}

export function useValidateCurrentDraft(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiRequest<{ data: FlowValidationResponse }>(
        `/ivr-flows/${flowId}/validate`,
        { method: 'POST', accessToken: session?.token },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId, 'versions'] });
    },
  });
}

export function useSimulateCurrentDraft(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: {
      digits?: string[];
      collected_digits?: Record<string, string>;
      caller_number?: string;
      now?: string;
      force_timeout?: boolean;
      force_timeout_nodes?: string[];
      force_invalid?: boolean;
      force_invalid_nodes?: string[];
      variables?: Record<string, string>;
    }) => {
      const r = await apiRequest<{ data: FlowSimulationResponse }>(
        `/ivr-flows/${flowId}/simulate`,
        {
          method: 'POST',
          body: JSON.stringify(body ?? {}),
          accessToken: session?.token,
        },
      );
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows', flowId, 'versions'] });
    },
  });
}

export function usePublishFlowVersion(flowId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const r = await apiRequest<{ data: FlowPublishResponse }>(
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
      const r = await apiRequest<{ data: FlowPublishResponse }>(
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
