export interface QueueStat {
  queue_id: string;
  queue_name: string;
  strategy: string;
  status: string;
  member_count: number;
  sla_target_seconds: number;
  pending_callbacks: number;
}

export interface AgentSummary {
  agent_profile_id: string;
  display_name: string;
  state: string | null;
  reason: string | null;
  queue_count: number;
}

export interface SlaMetric {
  queue_id: string;
  queue_name: string;
  sla_target_seconds: number;
  pending_callbacks: number;
  scheduled_callbacks: number;
  reached_callbacks: number;
  expired_callbacks: number;
}

export interface DashboardView {
  queues: QueueStat[];
  agents: AgentSummary[];
  sla_metrics: SlaMetric[];
  captured_at: Date;
}

export interface WallboardView {
  queues: QueueStat[];
  agents_available: number;
  agents_busy: number;
  agents_away: number;
  agents_offline: number;
  captured_at: Date;
}
