import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type TenantRetentionPolicy = {
  id: string;
  tenant_id: string;
  recording_retention_days: number | null;
  transcript_retention_days: number | null;
  cdr_retention_days: number | null;
  created_at: string;
  updated_at: string;
};

export type LegalHoldStatus = 'active' | 'released' | 'expired';
export type LegalHoldResourceType = 'recording' | 'transcript' | 'cdr' | 'all';

export type LegalHold = {
  id: string;
  tenant_id: string;
  resource_type: LegalHoldResourceType;
  resource_id: string | null;
  initiated_by: string;
  case_reference: string | null;
  reason: string;
  status: LegalHoldStatus;
  released_by: string | null;
  released_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateLegalHoldInput = {
  resource_type: LegalHoldResourceType;
  resource_id?: string | null;
  case_reference?: string | null;
  reason: string;
  expires_at?: string | null;
};

function noRetryOnAuth(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useRetentionPolicy() {
  const { session } = useAuth();
  const token = session?.token;
  return useQuery<TenantRetentionPolicy | null>({
    queryKey: ['retention-policy'],
    queryFn: async () => {
      const res = await apiRequest<{ data: TenantRetentionPolicy | null }>(
        '/recordings/retention-policy',
        { accessToken: token },
      );
      return res.data;
    },
    enabled: !!token,
    retry: noRetryOnAuth,
  });
}

export function useUpdateRetentionPolicy() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Pick<TenantRetentionPolicy, 'recording_retention_days' | 'transcript_retention_days' | 'cdr_retention_days'>>) =>
      apiRequest<{ data: TenantRetentionPolicy }>('/recordings/retention-policy', {
        method: 'PUT',
        body: JSON.stringify(input),
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['retention-policy'] }); },
  });
}

export function useLegalHolds(status?: LegalHoldStatus) {
  const { session } = useAuth();
  const token = session?.token;
  const params = status ? `?status=${status}` : '';
  return useQuery<LegalHold[]>({
    queryKey: ['legal-holds', status],
    queryFn: async () => {
      const res = await apiRequest<{ data: LegalHold[] }>(
        `/recordings/legal-holds${params}`,
        { accessToken: token },
      );
      return res.data;
    },
    enabled: !!token,
    retry: noRetryOnAuth,
  });
}

export function useCreateLegalHold() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLegalHoldInput) =>
      apiRequest('/recordings/legal-holds', {
        method: 'POST',
        body: JSON.stringify(input),
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['legal-holds'] }); },
  });
}

export function useReleaseLegalHold() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/recordings/legal-holds/${id}/release`, {
        method: 'POST',
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['legal-holds'] }); },
  });
}
