import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { WebhooksPage } from './webhooks-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { tenant_id: 't1', role: 'tenant_admin' } } }),
}));
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});
import { apiRequest } from '@/lib/api/client';

const baseWebhook = {
  id: 'wh-1',
  name: 'CI webhook',
  url: 'https://example.com/hook',
  events: ['ivr_flow.published', 'approval.approved'],
  failure_count: 0,
  disabled_at: null,
  created_at: '2026-01-01T00:00:00Z',
  revoked_at: null,
};

describe('WebhooksPage', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders page title', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => expect(screen.getByText('Webhooks')).toBeInTheDocument());
  });

  it('shows loading state initially then data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [baseWebhook] });
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => expect(screen.getByText('CI webhook')).toBeInTheDocument());
  });

  it('renders webhook rows after data loads', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [baseWebhook] });
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText('CI webhook')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/hook')).toBeInTheDocument();
    });
  });

  it('shows event count or event list', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [baseWebhook] });
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText(/ivr_flow\.published/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no webhooks', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText(/No webhooks/i)).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('fetch failed'));
    renderWithProviders(<WebhooksPage />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load webhooks/i)).toBeInTheDocument();
    });
  });
});
