import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type QueueSlaPolicy = {
  id: string;
  tenant_id: string;
  queue_id: string;
  answer_target_seconds: number;
  answer_rate_target_percent: number;
  abandonment_threshold_percent: number;
  wallboard_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type UpsertQueueSlaPolicyInput = {
  answer_target_seconds?: number;
  answer_rate_target_percent?: number;
  abandonment_threshold_percent?: number;
  wallboard_enabled?: boolean;
};

export type DispositionCodeStatus = 'active' | 'inactive';

export type DispositionCode = {
  id: string;
  tenant_id: string;
  queue_id: string | null;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: DispositionCodeStatus;
  created_at: string;
  updated_at: string;
};

export type CreateDispositionCodeInput = {
  queue_id?: string | null;
  code: string;
  label: string;
  description?: string | null;
  sort_order?: number;
  status?: DispositionCodeStatus;
};

export type UpdateDispositionCodeInput = Partial<CreateDispositionCodeInput>;

export type CallDisposition = {
  id: string;
  tenant_id: string;
  call_id: string;
  queue_id: string | null;
  agent_profile_id: string | null;
  disposition_code_id: string | null;
  disposition_code: string | null;
  disposition_label: string | null;
  note_text: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertCallDispositionInput = {
  queue_id?: string | null;
  agent_profile_id?: string | null;
  disposition_code_id?: string | null;
  note_text?: string | null;
};

export type DispositionUsageRow = {
  disposition_code_id: string | null;
  disposition_code: string | null;
  disposition_label: string | null;
  queue_id: string | null;
  queue_name: string | null;
  usage_count: number;
  last_used_at: string | null;
};

export type QaScorecardCriterion = {
  key: string;
  label: string;
  description?: string | null;
  max_score: number;
};

export type QaScorecardStatus = 'active' | 'inactive';

export type QaScorecard = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: QaScorecardStatus;
  criteria_json: QaScorecardCriterion[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateQaScorecardInput = {
  name: string;
  description?: string | null;
  status?: QaScorecardStatus;
  criteria_json: QaScorecardCriterion[];
};

export type UpdateQaScorecardInput = Partial<CreateQaScorecardInput>;

export type QaReviewStatus = 'draft' | 'completed' | 'acknowledged';

export type QaReviewScore = {
  key: string;
  label: string;
  score: number;
  max_score: number;
  note?: string | null;
};

export type QaReview = {
  id: string;
  tenant_id: string;
  call_id: string;
  queue_id: string | null;
  agent_profile_id: string | null;
  recording_id: string | null;
  disposition_id: string | null;
  scorecard_id: string;
  reviewer_user_id: string | null;
  status: QaReviewStatus;
  scores_json: QaReviewScore[];
  note_text: string | null;
  total_score: number;
  max_score: number;
  completed_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateQaReviewInput = {
  call_id: string;
  queue_id?: string | null;
  agent_profile_id?: string | null;
  recording_id?: string | null;
  disposition_id?: string | null;
  scorecard_id: string;
  scores_json: QaReviewScore[];
  note_text?: string | null;
  status?: QaReviewStatus;
};

export type UpdateQaReviewInput = Partial<Omit<CreateQaReviewInput, 'call_id' | 'scorecard_id'>>;

export type QaSummary = {
  open_reviews: number;
  completed_reviews_7d: number;
  average_score_percent_7d: number | null;
};

export type AgentAvailabilityBucket = {
  state: 'available' | 'busy' | 'away' | 'wrap_up' | 'offline';
  count: number;
};

export type QueueWallboardMetric = {
  queue_id: string;
  queue_name: string;
  member_count: number;
  available_agents: number;
  busy_agents: number;
  away_agents: number;
  wrap_up_agents: number;
  offline_agents: number;
  offered_calls_24h: number;
  answered_calls_24h: number;
  abandoned_calls_24h: number;
  active_calls: number;
  average_wait_seconds: number | null;
  max_wait_seconds: number | null;
  answer_target_seconds: number;
  answer_rate_target_percent: number;
  abandonment_threshold_percent: number;
  within_sla_calls_24h: number;
  sla_percent_24h: number | null;
  wallboard_enabled: boolean;
  alert_state: 'healthy' | 'warning' | 'critical';
};

export type SupervisorSnapshot = {
  generated_at: string;
  queue_metrics: QueueWallboardMetric[];
  agent_availability: AgentAvailabilityBucket[];
  disposition_usage_24h: DispositionUsageRow[];
  qa_summary: QaSummary;
};

export type AgentProfile = {
  id: string;
  tenant_id: string;
  user_id: string;
  display_name: string;
  max_concurrent_calls: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  availability: {
    id: string;
    tenant_id: string;
    agent_profile_id: string;
    state: AgentAvailabilityBucket['state'];
    reason: string | null;
    updated_at: string;
  } | null;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useSupervisorSnapshot(refetchInterval = 15000) {
  const { session } = useAuth();
  return useQuery<SupervisorSnapshot>({
    queryKey: ['contact-center', 'supervisor-snapshot'],
    queryFn: async () => {
      const res = await apiRequest<{ data: SupervisorSnapshot }>('/contact-center/supervisor/snapshot', {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
    refetchInterval,
  });
}

export function useQueueWallboard(refetchInterval = 15000) {
  const { session } = useAuth();
  return useQuery<SupervisorSnapshot>({
    queryKey: ['contact-center', 'wallboard'],
    queryFn: async () => {
      const res = await apiRequest<{ data: SupervisorSnapshot }>('/contact-center/wallboard', {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
    refetchInterval,
  });
}

export function useQueueSlaPolicy(queueId: string | null) {
  const { session } = useAuth();
  return useQuery<QueueSlaPolicy>({
    queryKey: ['contact-center', 'queue-sla', queueId],
    queryFn: async () => {
      const res = await apiRequest<{ data: QueueSlaPolicy }>(`/contact-center/queues/${queueId}/sla`, {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token && queueId),
    retry: noRetryOnAuthError,
  });
}

export function useUpdateQueueSlaPolicy() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ queueId, input }: { queueId: string; input: UpsertQueueSlaPolicyInput }) => {
      const res = await apiRequest<{ data: QueueSlaPolicy }>(`/contact-center/queues/${queueId}/sla`, {
        method: 'PUT',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'supervisor-snapshot'] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'wallboard'] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'queue-sla', variables.queueId] });
    },
  });
}

export function useDispositionCodes() {
  const { session } = useAuth();
  return useQuery<DispositionCode[]>({
    queryKey: ['contact-center', 'disposition-codes'],
    queryFn: async () => {
      const res = await apiRequest<{ data: DispositionCode[] }>('/contact-center/disposition-codes', {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useCreateDispositionCode() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDispositionCodeInput) => {
      const res = await apiRequest<{ data: DispositionCode }>('/contact-center/disposition-codes', {
        method: 'POST',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'disposition-codes'] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'supervisor-snapshot'] });
    },
  });
}

export function useUpdateDispositionCode() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateDispositionCodeInput }) => {
      const res = await apiRequest<{ data: DispositionCode }>(`/contact-center/disposition-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'disposition-codes'] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'supervisor-snapshot'] });
    },
  });
}

export function useCallDisposition(callId: string | null) {
  const { session } = useAuth();
  return useQuery<CallDisposition | null>({
    queryKey: ['contact-center', 'call-disposition', callId],
    queryFn: async () => {
      const res = await apiRequest<{ data: CallDisposition | null }>(`/contact-center/calls/${callId}/disposition`, {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token && callId),
    retry: noRetryOnAuthError,
  });
}

export function useUpsertCallDisposition() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ callId, input }: { callId: string; input: UpsertCallDispositionInput }) => {
      const res = await apiRequest<{ data: CallDisposition }>(`/contact-center/calls/${callId}/disposition`, {
        method: 'PUT',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'call-disposition', variables.callId] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'supervisor-snapshot'] });
    },
  });
}

export function useQaScorecards() {
  const { session } = useAuth();
  return useQuery<QaScorecard[]>({
    queryKey: ['contact-center', 'qa-scorecards'],
    queryFn: async () => {
      const res = await apiRequest<{ data: QaScorecard[] }>('/contact-center/qa-scorecards', {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useCreateQaScorecard() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQaScorecardInput) => {
      const res = await apiRequest<{ data: QaScorecard }>('/contact-center/qa-scorecards', {
        method: 'POST',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'qa-scorecards'] });
    },
  });
}

export function useUpdateQaScorecard() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateQaScorecardInput }) => {
      const res = await apiRequest<{ data: QaScorecard }>(`/contact-center/qa-scorecards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'qa-scorecards'] });
    },
  });
}

export function useQaReviews() {
  const { session } = useAuth();
  return useQuery<QaReview[]>({
    queryKey: ['contact-center', 'qa-reviews'],
    queryFn: async () => {
      const res = await apiRequest<{ data: QaReview[] }>('/contact-center/qa-reviews', {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}

export function useCreateQaReview() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQaReviewInput) => {
      const res = await apiRequest<{ data: QaReview }>('/contact-center/qa-reviews', {
        method: 'POST',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'qa-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'supervisor-snapshot'] });
    },
  });
}

export function useUpdateQaReview() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateQaReviewInput }) => {
      const res = await apiRequest<{ data: QaReview }>(`/contact-center/qa-reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
        accessToken: session?.token,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'qa-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['contact-center', 'supervisor-snapshot'] });
    },
  });
}

export function useAgentProfiles() {
  const { session } = useAuth();
  return useQuery<AgentProfile[]>({
    queryKey: ['agent-profiles'],
    queryFn: async () => {
      const res = await apiRequest<{ data: AgentProfile[] }>('/agent-profiles', {
        accessToken: session?.token,
      });
      return res.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthError,
  });
}
