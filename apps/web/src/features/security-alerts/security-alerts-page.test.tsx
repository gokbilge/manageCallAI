import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render } from '@/test/render';
import { SecurityAlertsPage } from './security-alerts-page';

const mutations = vi.hoisted(() => ({
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  dismissAlert: vi.fn(),
  deleteAlertRule: vi.fn(),
}));

vi.mock('@/lib/security-alerts/security-alerts-api', () => ({
  useSecurityAlerts: vi.fn(),
  useAlertRules: vi.fn(),
  useAcknowledgeAlert: vi.fn(() => ({ mutateAsync: mutations.acknowledgeAlert, isPending: false })),
  useResolveAlert: vi.fn(() => ({ mutateAsync: mutations.resolveAlert, isPending: false })),
  useDismissAlert: vi.fn(() => ({ mutateAsync: mutations.dismissAlert, isPending: false })),
  useDeleteAlertRule: vi.fn(() => ({ mutateAsync: mutations.deleteAlertRule, isPending: false })),
}));

vi.mock('@tanstack/react-query', async (imp) => {
  const actual = await imp<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) };
});

import {
  useSecurityAlerts,
  useAlertRules,
} from '@/lib/security-alerts/security-alerts-api';

const baseAlert = {
  id: 'alert-1',
  tenant_id: 't1',
  rule_id: 'rule-1',
  alert_type: 'failed_sip_registration',
  severity: 'warning' as const,
  message: '7 SIP failures in 10 minutes',
  context_json: null,
  status: 'new' as const,
  acknowledged_by: null,
  acknowledged_at: null,
  resolved_at: null,
  fired_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const baseRule = {
  id: 'rule-1',
  tenant_id: 't1',
  name: 'SIP Failure Alert',
  description: null,
  alert_type: 'failed_sip_registration' as const,
  conditions: { threshold: 5, window_minutes: 10 },
  severity: 'warning' as const,
  status: 'active' as const,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('SecurityAlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutations.acknowledgeAlert.mockResolvedValue({ ...baseAlert, status: 'acknowledged' });
    mutations.resolveAlert.mockResolvedValue({ ...baseAlert, status: 'resolved' });
    mutations.dismissAlert.mockResolvedValue({ ...baseAlert, status: 'dismissed' });
    mutations.deleteAlertRule.mockResolvedValue(undefined);
  });

  it('shows loading state while alerts are fetching', () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    render(<SecurityAlertsPage />);
    expect(screen.getByText(/loading alerts/i)).toBeInTheDocument();
  });

  it('shows a fired alert with severity, type and message', () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [baseAlert] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<SecurityAlertsPage />);
    expect(screen.getByText('7 SIP failures in 10 minutes')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('shows empty state when no alerts exist', () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<SecurityAlertsPage />);
    expect(screen.getByText(/no new alerts found/i)).toBeInTheDocument();
  });

  it('shows error state when alerts fail to load', () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('fail') } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<SecurityAlertsPage />);
    expect(screen.getByText(/could not load security alerts/i)).toBeInTheDocument();
  });

  it('shows a rule in the rules panel', () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [baseRule] } as never);
    render(<SecurityAlertsPage />);
    expect(screen.getByText('SIP Failure Alert')).toBeInTheDocument();
  });

  it('shows acknowledge and resolve buttons for new alerts', () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [baseAlert] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<SecurityAlertsPage />);
    expect(screen.getByLabelText('Acknowledge')).toBeInTheDocument();
    expect(screen.getByLabelText('Resolve')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('does not show acknowledge button for resolved alerts', () => {
    const resolved = { ...baseAlert, status: 'resolved' as const };
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [resolved] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<SecurityAlertsPage />);
    expect(screen.queryByLabelText('Acknowledge')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Resolve')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('invokes alert action mutations from row controls', async () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [baseAlert] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<SecurityAlertsPage />);

    fireEvent.click(screen.getByLabelText('Acknowledge'));
    fireEvent.click(screen.getByLabelText('Resolve'));
    fireEvent.click(screen.getByLabelText('Dismiss'));

    await waitFor(() => {
      expect(mutations.acknowledgeAlert).toHaveBeenCalledWith('alert-1');
      expect(mutations.resolveAlert).toHaveBeenCalledWith('alert-1');
      expect(mutations.dismissAlert).toHaveBeenCalledWith('alert-1');
    });
  });

  it('invokes rule deletion and changes the alert status filter', async () => {
    vi.mocked(useSecurityAlerts).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    vi.mocked(useAlertRules).mockReturnValue({ isLoading: false, isError: false, data: [baseRule] } as never);
    render(<SecurityAlertsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByLabelText('Delete rule SIP Failure Alert'));

    await waitFor(() => {
      expect(useSecurityAlerts).toHaveBeenLastCalledWith(undefined);
      expect(mutations.deleteAlertRule).toHaveBeenCalledWith('rule-1');
    });
  });
});
