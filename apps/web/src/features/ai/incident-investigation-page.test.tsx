import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentInvestigationPage } from './incident-investigation-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 'tenant-1', role: 'tenant_operator' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const sampleInvestigation = {
  id: 'inv-1',
  tenant_id: 'tenant-1',
  question: 'Why are calls failing?',
  context: { call_ids: ['call-1'] },
  answer: 'Investigation of: "Why are calls failing?"\n\nFound 1 call(s) with failure events.',
  citations: [
    { source: 'call_event', id: 'call-1', label: 'Call call-1', fact: 'failed (source: freeswitch)' },
    { source: 'recording', id: 'rec-1', label: 'Recording for call call-1', fact: 'Recording summary (deterministic): Route match failed.' },
  ],
  data_sources: ['call_events', 'recordings'],
  is_advisory: true,
  created_by: 'user-1',
  created_at: '2026-06-06T10:00:00Z',
};

describe('IncidentInvestigationPage', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('renders the empty investigation state', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<IncidentInvestigationPage />);

    await screen.findByText(/No investigations yet\./i);
    expect(screen.getByText(/Run an investigation or pick a recent one/i)).toBeInTheDocument();
  });

  it('renders investigation history and detail', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('/incidents/investigate')) return { data: [sampleInvestigation] };
      return { data: [] };
    });

    renderWithProviders(<IncidentInvestigationPage />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/incidents/investigate', expect.anything()));
    await screen.findAllByText('Why are calls failing?');
    expect(screen.getByText('Recording summary (deterministic): Route match failed.')).toBeInTheDocument();
  });

  it('submits a new investigation', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return { data: sampleInvestigation };
      return { data: [sampleInvestigation] };
    });

    renderWithProviders(<IncidentInvestigationPage />);
    fireEvent.change(screen.getByPlaceholderText(/Why are outbound calls failing/i), {
      target: { value: 'Check the carrier incident' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run investigation/i }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      '/incidents/investigate',
      expect.objectContaining({ method: 'POST' }),
    ));
  });

  it('renders submit errors without replacing the empty detail state', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') throw new Error('submit failed');
      return { data: [] };
    });

    renderWithProviders(<IncidentInvestigationPage />);
    fireEvent.change(screen.getByPlaceholderText(/Why are outbound calls failing/i), {
      target: { value: 'Check the carrier incident' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run investigation/i }));

    await screen.findByText('submit failed');
    expect(screen.getByText(/Run an investigation or pick a recent one/i)).toBeInTheDocument();
  });
});
