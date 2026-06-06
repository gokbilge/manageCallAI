import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { QaWorkflowsPage } from './qa-workflows-page';

const createReview = vi.fn().mockResolvedValue({ id: 'review-2' });
const acknowledgeReview = vi.fn().mockResolvedValue(undefined);
const scorecards = [
  {
    id: 'scorecard-1',
    tenant_id: 'tenant-1',
    name: 'Support QA',
    description: 'Default scorecard',
    status: 'active' as const,
    criteria_json: [
      { key: 'greeting', label: 'Greeting', description: null, max_score: 5 },
      { key: 'resolution', label: 'Resolution', description: null, max_score: 5 },
    ],
    created_by: 'user-1',
    created_at: '2026-06-06T08:00:00Z',
    updated_at: '2026-06-06T08:00:00Z',
  },
];
const reviews = [
  {
    id: 'review-1',
    tenant_id: 'tenant-1',
    call_id: 'call-1',
    queue_id: 'queue-1',
    agent_profile_id: 'agent-1',
    recording_id: 'recording-1',
    disposition_id: 'disp-1',
    scorecard_id: 'scorecard-1',
    reviewer_user_id: 'user-1',
    status: 'completed' as const,
    scores_json: [
      { key: 'greeting', label: 'Greeting', score: 5, max_score: 5, note: null },
      { key: 'resolution', label: 'Resolution', score: 4, max_score: 5, note: null },
    ],
    note_text: 'Good call.',
    total_score: 9,
    max_score: 10,
    completed_at: '2026-06-06T08:00:00Z',
    acknowledged_at: null,
    created_at: '2026-06-06T08:00:00Z',
    updated_at: '2026-06-06T08:00:00Z',
  },
];
const disposition = {
  id: 'disp-1',
  queue_id: 'queue-1',
  agent_profile_id: 'agent-1',
  disposition_label: 'Resolved',
  disposition_code: 'resolved',
};

vi.mock('@/lib/contact-center/contact-center-api', () => ({
  useQaScorecards: () => ({
    data: scorecards,
    refetch: vi.fn(),
  }),
  useQaReviews: () => ({
    data: reviews,
    refetch: vi.fn(),
  }),
  useCreateQaScorecard: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  useUpdateQaScorecard: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
  useCreateQaReview: () => ({
    mutateAsync: createReview,
    isPending: false,
  }),
  useUpdateQaReview: () => ({
    mutateAsync: acknowledgeReview,
    isPending: false,
  }),
  useAgentProfiles: () => ({
    data: [{ id: 'agent-1', display_name: 'Alice Support', status: 'active' }],
  }),
  useCallDisposition: () => ({
    data: disposition,
  }),
}));

vi.mock('@/lib/ivr-flows/ivr-flows-api', () => ({
  useQueueOptions: () => ({
    data: [{ id: 'queue-1', name: 'Support' }],
  }),
}));

describe('QaWorkflowsPage', () => {
  beforeEach(() => {
    createReview.mockClear();
    acknowledgeReview.mockClear();
  });

  it('renders scorecards and existing reviews', () => {
    renderWithProviders(<QaWorkflowsPage />);

    expect(screen.getByText('QA Scoring Workflow')).toBeInTheDocument();
    expect(screen.getAllByText('Support QA').length).toBeGreaterThan(0);
    expect(screen.getByText('call-1')).toBeInTheDocument();
    expect(screen.getByText('Selected review')).toBeInTheDocument();
  });

  it('creates a review using the active scorecard and linked disposition', async () => {
    renderWithProviders(<QaWorkflowsPage />);

    fireEvent.change(screen.getByLabelText('Call ID'), { target: { value: 'call-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create review' }));

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
        call_id: 'call-2',
        scorecard_id: 'scorecard-1',
        disposition_id: 'disp-1',
      }));
    });
  });

  it('acknowledges the selected review', async () => {
    renderWithProviders(<QaWorkflowsPage />);

    fireEvent.click(screen.getByText('Mark acknowledged'));

    await waitFor(() => {
      expect(acknowledgeReview).toHaveBeenCalledWith({
        id: 'review-1',
        input: { status: 'acknowledged' },
      });
    });
  });
});
