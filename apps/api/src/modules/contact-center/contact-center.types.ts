import type {
  QaReviewStatus,
  QaScorecardStatus,
  DispositionCodeStatus,
} from '@managecallai/contracts';

export interface QueueSlaPolicy {
  id: string;
  tenant_id: string;
  queue_id: string;
  answer_target_seconds: number;
  answer_rate_target_percent: number;
  abandonment_threshold_percent: number;
  wallboard_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DispositionCode {
  id: string;
  tenant_id: string;
  queue_id: string | null;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: DispositionCodeStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CallDisposition {
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
  created_at: Date;
  updated_at: Date;
}

export interface QaScorecardCriterion {
  key: string;
  label: string;
  description?: string | null;
  max_score: number;
}

export interface QaScorecard {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: QaScorecardStatus;
  criteria_json: QaScorecardCriterion[];
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface QaReviewScore {
  key: string;
  label: string;
  score: number;
  max_score: number;
  note?: string | null;
}

export interface QaReview {
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
  completed_at: Date | null;
  acknowledged_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DispositionUsageRow {
  disposition_code_id: string | null;
  disposition_code: string | null;
  disposition_label: string | null;
  queue_id: string | null;
  queue_name: string | null;
  usage_count: number;
  last_used_at: Date | null;
}

export interface QueueWallboardMetric {
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
}

export interface AgentAvailabilityBucket {
  state: 'available' | 'busy' | 'away' | 'wrap_up' | 'offline';
  count: number;
}

export interface QaSummary {
  open_reviews: number;
  completed_reviews_7d: number;
  average_score_percent_7d: number | null;
}

export interface SupervisorSnapshot {
  generated_at: string;
  queue_metrics: QueueWallboardMetric[];
  agent_availability: AgentAvailabilityBucket[];
  disposition_usage_24h: DispositionUsageRow[];
  qa_summary: QaSummary;
}
