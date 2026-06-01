import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertInstanceStatus = 'new' | 'acknowledged' | 'resolved' | 'dismissed';
export type AlertRuleStatus = 'active' | 'inactive' | 'archived';
export type AlertType =
  | 'failed_sip_registration'
  | 'outbound_call_burst'
  | 'unknown_destination_call'
  | 'runtime_auth_failure'
  | 'webhook_delivery_backlog'
  | 'recording_analysis_backlog';

export type SecurityAlertInstance = {
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
};

export type SecurityAlertRule = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  alert_type: AlertType;
  conditions: Record<string, unknown>;
  severity: AlertSeverity;
  status: AlertRuleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function noRetryOnAuth(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

export function useSecurityAlerts(status?: AlertInstanceStatus) {
  const { session } = useAuth();
  const token = session?.token;
  const params = status ? `?status=${status}` : '';
  return useQuery<SecurityAlertInstance[]>({
    queryKey: ['security-alerts', status],
    queryFn: async () => {
      const res = await apiRequest<{ data: SecurityAlertInstance[] }>(
        `/observability/security/alerts${params}`,
        { accessToken: token },
      );
      return res.data;
    },
    enabled: !!token,
    retry: noRetryOnAuth,
  });
}

export function useAlertRules() {
  const { session } = useAuth();
  const token = session?.token;
  return useQuery<SecurityAlertRule[]>({
    queryKey: ['security-alert-rules'],
    queryFn: async () => {
      const res = await apiRequest<{ data: SecurityAlertRule[] }>(
        '/observability/security/alert-rules',
        { accessToken: token },
      );
      return res.data;
    },
    enabled: !!token,
    retry: noRetryOnAuth,
  });
}

export function useAcknowledgeAlert() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/observability/security/alerts/${id}/acknowledge`, {
        method: 'POST',
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['security-alerts'] }); },
  });
}

export function useResolveAlert() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/observability/security/alerts/${id}/resolve`, {
        method: 'POST',
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['security-alerts'] }); },
  });
}

export function useDismissAlert() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/observability/security/alerts/${id}/dismiss`, {
        method: 'POST',
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['security-alerts'] }); },
  });
}

export function useDeleteAlertRule() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/observability/security/alert-rules/${id}`, {
        method: 'DELETE',
        accessToken: session?.token,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['security-alert-rules'] }); },
  });
}
