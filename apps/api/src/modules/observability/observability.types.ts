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

export interface PlatformRuntimeSummary {
  active_sessions: number;
  completed_sessions_24h: number;
  failed_sessions_24h: number;
}

export interface FreeswitchNodeHealth {
  active: number;
  total: number;
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
  freeswitch_nodes: FreeswitchNodeHealth;
  generated_at: string;
}

// ── SLICE-48: Security alerts ─────────────────────────────────────────────────

export type AlertType =
  | 'failed_sip_registration'
  | 'outbound_call_burst'
  | 'unknown_destination_call'
  | 'runtime_auth_failure'
  | 'webhook_delivery_backlog'
  | 'recording_analysis_backlog';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'inactive' | 'archived';
export type AlertInstanceStatus = 'new' | 'acknowledged' | 'resolved' | 'dismissed';

export interface SecurityAlertRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  alert_type: AlertType;
  conditions: Record<string, unknown>;
  severity: AlertSeverity;
  status: AlertStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRuleInput {
  name: string;
  description?: string | null;
  alert_type: AlertType;
  conditions: Record<string, unknown>;
  severity?: AlertSeverity;
  status?: AlertStatus;
}

export interface UpdateAlertRuleInput {
  name?: string;
  description?: string | null;
  conditions?: Record<string, unknown>;
  severity?: AlertSeverity;
  status?: AlertStatus;
}

export interface SecurityAlertInstance {
  id: string;
  tenant_id: string;
  rule_id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  context_json: Record<string, unknown> | null;
  status: AlertInstanceStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  fired_at: string;
  created_at: string;
}

export interface AlertListFilter {
  status?: AlertInstanceStatus;
  severity?: AlertSeverity;
  since?: string;
  limit?: number;
}

export interface AlertRuleListFilter {
  alert_type?: AlertType;
  status?: AlertStatus;
}
