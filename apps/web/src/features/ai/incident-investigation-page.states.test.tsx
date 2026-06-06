import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentInvestigationPage } from './incident-investigation-page';
import { renderWithProviders } from '@/test/render';

const investigationsState = {
  data: [] as Array<{
    id: string;
    tenant_id: string;
    question: string;
    context: Record<string, unknown>;
    answer: string | null;
    citations: Array<{ source: string; id: string; label: string; fact: string }>;
    data_sources: string[];
    is_advisory: true;
    created_by: string | null;
    created_at: string;
  }>,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const createMutationState = {
  isPending: false,
  isError: false,
  error: null as Error | null,
  data: undefined as { data: { id: string } } | undefined,
  mutateAsync: vi.fn(),
};

vi.mock('@/lib/ai/incident-investigation-api', () => ({
  useIncidentInvestigations: () => investigationsState,
  useCreateIncidentInvestigation: () => createMutationState,
}));

describe('IncidentInvestigationPage states', () => {
  beforeEach(() => {
    investigationsState.data = [];
    investigationsState.isLoading = false;
    investigationsState.isError = false;
    investigationsState.refetch.mockReset();
    createMutationState.isPending = false;
    createMutationState.isError = false;
    createMutationState.error = null;
    createMutationState.data = undefined;
    createMutationState.mutateAsync.mockReset();
  });

  it('renders the loading state for investigation history', () => {
    investigationsState.isLoading = true;

    renderWithProviders(<IncidentInvestigationPage />);

    expect(screen.getByText(/Loading investigations/i)).toBeInTheDocument();
  });

  it('renders the investigation history error state', () => {
    investigationsState.isError = true;

    renderWithProviders(<IncidentInvestigationPage />);

    expect(screen.getByText('Could not load investigation history.')).toBeInTheDocument();
  });

  it('renders detail without citations when the investigation has none', () => {
    investigationsState.data = [{
      id: 'inv-empty',
      tenant_id: 'tenant-1',
      question: 'Did anything fail?',
      context: {},
      answer: null,
      citations: [],
      data_sources: [],
      is_advisory: true,
      created_by: 'user-1',
      created_at: '2026-06-06T10:00:00Z',
    }];

    renderWithProviders(<IncidentInvestigationPage />);

    expect(screen.getByText('No citations were available for this investigation scope.')).toBeInTheDocument();
    expect(screen.getByText('No answer returned.')).toBeInTheDocument();
  });
});
