import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type SipTrunkStatus = 'active' | 'inactive';
export type SipTrunkDirection = 'inbound' | 'outbound' | 'bidirectional';
export type SipTrunkTransport = 'udp' | 'tcp' | 'tls';
export type SipTrunkDtmfMode = 'rfc2833' | 'info' | 'inband' | 'auto';
export type SipTrunkSrtpPolicy = 'disabled' | 'optional' | 'required';

export type SipTrunk = {
  id: string;
  tenant_id: string;
  name: string;
  direction: SipTrunkDirection;
  status: SipTrunkStatus;
  username: string | null;
  realm: string;
  proxy: string;
  port: number;
  transport: SipTrunkTransport;
  auth_username: string;
  dtmf_mode: SipTrunkDtmfMode;
  codec_prefs: string[] | null;
  srtp_policy: SipTrunkSrtpPolicy;
  created_at: string;
  updated_at: string;
};

export type RuntimeApplyStatus = 'pending' | 'applying' | 'applied' | 'failed' | 'cancelled';

export type RuntimeApplyRequest = {
  id: string;
  tenant_id: string | null;
  triggered_by_type: 'user' | 'workflow' | 'system';
  triggered_by_id: string | null;
  action_type: string;
  target_node_id: string;
  target_profile: string | null;
  target_gateway: string | null;
  object_type: string;
  object_id: string;
  status: RuntimeApplyStatus;
  active_call_count: number | null;
  applied_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type GatewayStatusEntry = {
  trunk_id: string;
  trunk_name: string;
  node_id: string;
  state: string;
  queried_at: string;
};

export type CreateSipTrunkBody = {
  name: string;
  direction: SipTrunkDirection;
  realm: string;
  proxy: string;
  auth_username: string;
  auth_password: string;
  username?: string;
  port?: number;
  transport?: SipTrunkTransport;
  dtmf_mode?: SipTrunkDtmfMode;
  srtp_policy?: SipTrunkSrtpPolicy;
  codec_prefs?: string[] | null;
};

function noRetryOnAuth(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useSipTrunks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['sip-trunks'],
    queryFn: async () => {
      const r = await apiRequest<{ data: SipTrunk[] }>('/sip-trunks', { accessToken: session?.token });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuth,
  });
}

export function useTrunkApplyRequests(trunkId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['sip-trunks', trunkId, 'apply-requests'],
    queryFn: async () => {
      const r = await apiRequest<{ data: RuntimeApplyRequest[] }>(
        `/sip-trunks/${trunkId}/apply-requests`,
        { accessToken: session?.token },
      );
      return r.data;
    },
    enabled: Boolean(session?.token && trunkId),
    retry: noRetryOnAuth,
  });
}

export function useGatewayStatus() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['gateway-status'],
    queryFn: async () => {
      const r = await apiRequest<{ data: GatewayStatusEntry[] }>('/runtime/gateway-status', {
        accessToken: session?.token,
      });
      return r.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuth,
    refetchInterval: 30_000,
  });
}

export function useCreateSipTrunk() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSipTrunkBody) => {
      const r = await apiRequest<{ data: SipTrunk; runtime_apply: RuntimeApplyRequest[] }>(
        '/sip-trunks',
        { method: 'POST', body: JSON.stringify(body), accessToken: session?.token },
      );
      return r;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sip-trunks'] });
      void qc.invalidateQueries({ queryKey: ['gateway-status'] });
    },
  });
}

export function useDeactivateSipTrunk() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trunkId: string) => {
      const r = await apiRequest<{ data: SipTrunk }>(`/sip-trunks/${trunkId}/deactivate`, {
        method: 'POST',
        accessToken: session?.token,
      });
      return r.data;
    },
    onSuccess: (_data, trunkId) => {
      void qc.invalidateQueries({ queryKey: ['sip-trunks'] });
      void qc.invalidateQueries({ queryKey: ['sip-trunks', trunkId, 'apply-requests'] });
      void qc.invalidateQueries({ queryKey: ['gateway-status'] });
    },
  });
}
