export interface RunningSession {
  id: string;
  call_id: string;
  flow_id: string;
  caller_number: string | null;
  current_node_id: string | null;
  started_at: string;
}

export interface QueueDepth {
  queue_id: string;
  queue_name: string;
  member_count: number;
}

export interface WebhookBacklog {
  pending: number;
  processing: number;
  failed: number;
  abandoned: number;
}

export interface LiveSnapshot {
  tenant_id: string;
  active_session_count: number;
  running_sessions: RunningSession[];
  queue_depths: QueueDepth[];
  webhook_backlog: WebhookBacklog;
  recent_call_events_5m: number;
  recent_session_failures_1h: number;
  pending_approvals: number;
  generated_at: string;
}
