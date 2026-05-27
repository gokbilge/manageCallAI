import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type PhoneNumber = {
  id: string;
  tenant_id: string;
  e164_number: string;
  display_label: string | null;
  status: 'active' | 'inactive';
  assigned_target_type: 'inbound_route' | 'flow' | 'extension' | null;
  assigned_target_id: string | null;
  trunk_id: string | null;
  created_at: string;
  updated_at: string;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function usePhoneNumbers() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['phone-numbers'],
    queryFn: async () => {
      const r = await apiRequest<{ data: PhoneNumber[] }>('/phone-numbers', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useCreatePhoneNumber() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { e164_number: string; display_label?: string }) => {
      const r = await apiRequest<{ data: PhoneNumber }>('/phone-numbers', {
        method: 'POST',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['phone-numbers'] }); },
  });
}

export function useDeactivatePhoneNumber() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest<{ data: PhoneNumber }>(`/phone-numbers/${id}/deactivate`, {
        method: 'POST',
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['phone-numbers'] }); },
  });
}
