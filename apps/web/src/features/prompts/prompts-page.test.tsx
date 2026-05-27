import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PromptsPage } from './prompts-page';
import { renderWithProviders } from '@/test/render';
import { ApiError, apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'token',
      claims: { tenant_id: 'tenant-1' },
    },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

describe('PromptsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows loading then empty state when no prompts exist', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<PromptsPage />);

    expect(screen.getByText('Loading prompts...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No prompt assets yet')).toBeInTheDocument();
    });
  });

  it('renders prompt rows from API data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'p-1',
          name: 'Welcome message',
          media_type: 'audio/wav',
          language: 'en',
          storage_uri: 'gs://bucket/welcome.wav',
          status: 'active',
          created_at: '2026-05-28T00:00:00.000Z',
        },
      ],
    });

    renderWithProviders(<PromptsPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome message')).toBeInTheDocument();
      expect(screen.getByText('audio/wav')).toBeInTheDocument();
      expect(screen.getByText('gs://bucket/welcome.wav')).toBeInTheDocument();
    });
  });

  it('shows deactivate button for active prompts', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'p-1',
          name: 'Hold music',
          media_type: 'audio/mp3',
          language: null,
          storage_uri: 'gs://bucket/hold.mp3',
          status: 'active',
          created_at: '2026-05-28T00:00:00.000Z',
        },
      ],
    });

    renderWithProviders(<PromptsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
    });
  });

  it('shows error state when API call fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Unauthorized', 401));

    renderWithProviders(<PromptsPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not load prompts')).toBeInTheDocument();
    });
  });
});
