import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import type {
  SipTrunkDirection,
  SipTrunkDtmfMode,
  SipTrunkSrtpPolicy,
  SipTrunkTransport,
  RuntimeApplyStatus,
} from './sip-trunks-api';

export type CarrierAssistantDraft = {
  name: string | null;
  direction: SipTrunkDirection | null;
  username: string | null;
  realm: string | null;
  proxy: string | null;
  port: number | null;
  transport: SipTrunkTransport | null;
  auth_username: string | null;
  dtmf_mode: SipTrunkDtmfMode | null;
  codec_prefs: string[] | null;
  srtp_policy: SipTrunkSrtpPolicy | null;
};

export type CarrierAssistantSuggestion = {
  assistant_mode: 'create' | 'update';
  target_trunk_id: string | null;
  target_trunk_name: string | null;
  matched_template: string | null;
  suggested_config: CarrierAssistantDraft;
  missing_fields: Array<{ field: string; reason: string }>;
  assumptions: string[];
  warnings: string[];
  validation_errors: string[];
  validation_checks: Array<{ code: string; description: string; status: 'ready' | 'needs_input' | 'recommended' }>;
  next_steps: string[];
  runtime_hint: {
    gateway_state: string | null;
    gateway_observed_at: string | null;
    latest_apply_status: RuntimeApplyStatus | null;
    latest_apply_error: string | null;
  } | null;
};

export type CreateCarrierAssistantSuggestionBody = {
  intent: string;
  trunk_id?: string;
};

export function useCarrierAssistantSuggestion() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (body: CreateCarrierAssistantSuggestionBody) => {
      return apiRequest<{ data: CarrierAssistantSuggestion }>('/sip-trunks/assistant/draft', {
        method: 'POST',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
    },
  });
}
