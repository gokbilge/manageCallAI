import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type InvestigationCitation = {
  source: 'call_event' | 'inbound_route' | 'outbound_route' | 'sip_trunk' | 'recording' | 'gateway_status';
  id: string;
  label: string;
  fact: string;
};

export type InvestigationContext = {
  call_ids?: string[];
  route_ids?: string[];
  time_range?: { from: string; to: string };
};

export type IncidentInvestigation = {
  id: string;
  tenant_id: string;
  question: string;
  context: InvestigationContext;
  answer: string | null;
  citations: InvestigationCitation[];
  data_sources: string[];
  is_advisory: true;
  created_by: string | null;
  created_at: string;
};

export type CreateIncidentInvestigationBody = {
  question: string;
  context?: InvestigationContext;
};

function noRetryOnAuth(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useIncidentInvestigations() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['incident-investigations', session?.claims.tenant_id],
    queryFn: async () => {
      const response = await apiRequest<{ data: IncidentInvestigation[] }>('/incidents/investigate', {
        accessToken: session?.token,
      });
      return response.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuth,
  });
}

export function useCreateIncidentInvestigation() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateIncidentInvestigationBody) => {
      return apiRequest<{ data: IncidentInvestigation }>('/incidents/investigate', {
        method: 'POST',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['incident-investigations', session?.claims.tenant_id] });
    },
  });
}
