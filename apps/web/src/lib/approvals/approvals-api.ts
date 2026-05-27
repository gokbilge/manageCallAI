import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type ApprovalRequest = {
  id: string;
  tenant_id: string;
  object_type: string;
  object_id: string;
  version_id: string | null;
  requested_by: string | null;
  status: ApprovalStatus;
  created_at: string;
  flow_name: string | null;
  action_type: 'publish' | 'rollback' | null;
};

export type ApprovalDecisionResult = {
  approval_request: ApprovalRequest;
  action_type: 'publish' | 'rollback';
  publish_result?: 'success';
};

export type Policy = {
  id: string;
  tenant_id: string;
  policy_type: string;
  status: string;
  rules: Record<string, unknown>;
  created_at: string;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useApprovals() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const r = await apiRequest<{ data: ApprovalRequest[] }>('/approvals', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function usePolicies() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const r = await apiRequest<{ data: Policy[] }>('/policies', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useApproveRequest() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest<{ data: ApprovalDecisionResult }>(`/approvals/${id}/approve`, {
        method: 'POST',
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['approvals'] });
      void qc.invalidateQueries({ queryKey: ['ivr-flows'] });
    },
  });
}

export function useRejectRequest() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest<{ data: ApprovalDecisionResult }>(`/approvals/${id}/reject`, {
        method: 'POST',
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
}
