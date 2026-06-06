import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SupervisorDashboardPage } from './supervisor-dashboard-page';

const mutateAsync = vi.fn().mockResolvedValue(undefined);
const snapshotData = {
  generated_at: '2026-06-06T10:00:00Z',
  queue_metrics: [
    {
      queue_id: 'queue-1',
      queue_name: 'Support',
      member_count: 4,
      available_agents: 2,
      busy_agents: 1,
      away_agents: 0,
      wrap_up_agents: 1,
      offline_agents: 0,
      offered_calls_24h: 20,
      answered_calls_24h: 18,
      abandoned_calls_24h: 2,
      active_calls: 1,
      average_wait_seconds: 16,
      max_wait_seconds: 52,
      answer_target_seconds: 20,
      answer_rate_target_percent: 80,
      abandonment_threshold_percent: 10,
      within_sla_calls_24h: 15,
      sla_percent_24h: 83.3,
      wallboard_enabled: true,
      alert_state: 'warning' as const,
    },
  ],
  agent_availability: [
    { state: 'available' as const, count: 2 },
    { state: 'busy' as const, count: 1 },
    { state: 'away' as const, count: 0 },
    { state: 'wrap_up' as const, count: 1 },
    { state: 'offline' as const, count: 0 },
  ],
  disposition_usage_24h: [
    {
      disposition_code_id: 'code-1',
      disposition_code: 'resolved',
      disposition_label: 'Resolved',
      queue_id: 'queue-1',
      queue_name: 'Support',
      usage_count: 8,
      last_used_at: '2026-06-06T09:00:00Z',
    },
  ],
  qa_summary: {
    open_reviews: 2,
    completed_reviews_7d: 5,
    average_score_percent_7d: 92.1,
  },
};
const policyData = {
  id: 'policy-1',
  tenant_id: 'tenant-1',
  queue_id: 'queue-1',
  answer_target_seconds: 20,
  answer_rate_target_percent: 80,
  abandonment_threshold_percent: 10,
  wallboard_enabled: true,
  created_at: '2026-06-06T08:00:00Z',
  updated_at: '2026-06-06T08:00:00Z',
};
const dispositionCodes = [
  {
    id: 'code-1',
    tenant_id: 'tenant-1',
    queue_id: null,
    code: 'resolved',
    label: 'Resolved',
    description: null,
    sort_order: 0,
    status: 'active' as const,
    created_at: '2026-06-06T08:00:00Z',
    updated_at: '2026-06-06T08:00:00Z',
  },
];

vi.mock('@/lib/contact-center/contact-center-api', () => ({
  useSupervisorSnapshot: () => ({
    data: snapshotData,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useQueueSlaPolicy: () => ({
    data: policyData,
    isLoading: false,
    isError: false,
  }),
  useUpdateQueueSlaPolicy: () => ({
    mutateAsync,
    isPending: false,
  }),
  useDispositionCodes: () => ({
    data: dispositionCodes,
  }),
  useCreateDispositionCode: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  useUpdateDispositionCode: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock('@/lib/ivr-flows/ivr-flows-api', () => ({
  useQueueOptions: () => ({
    data: [{ id: 'queue-1', name: 'Support' }],
  }),
}));

describe('SupervisorDashboardPage', () => {
  beforeEach(() => {
    mutateAsync.mockClear();
  });

  it('renders queue health and disposition usage', () => {
    renderWithProviders(<SupervisorDashboardPage />);

    expect(screen.getByText('Supervisor Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('Support').length).toBeGreaterThan(0);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Open reviews')).toBeInTheDocument();
  });

  it('saves the queue SLA policy for the selected queue', async () => {
    renderWithProviders(<SupervisorDashboardPage />);

    fireEvent.click(screen.getByText('Save SLA Policy'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        queueId: 'queue-1',
        input: {
          answer_target_seconds: 20,
          answer_rate_target_percent: 80,
          abandonment_threshold_percent: 10,
          wallboard_enabled: true,
        },
      });
    });
  });
});
