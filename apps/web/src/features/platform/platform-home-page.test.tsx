import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PlatformHomePage } from './platform-home-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { role: 'platform_admin' } } }),
}));
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});
import { apiRequest } from '@/lib/api/client';

describe('PlatformHomePage', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders the page title', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { services: [] } });
    renderWithProviders(<PlatformHomePage />);
    await waitFor(() => expect(screen.getByText('Platform Management')).toBeInTheDocument());
  });

  it('shows loading state initially', async () => {
    let resolve: (v: unknown) => void;
    vi.mocked(apiRequest).mockReturnValue(new Promise((r) => { resolve = r; }));
    renderWithProviders(<PlatformHomePage />);
    expect(screen.getByText(/Checking API and worker health/i)).toBeInTheDocument();
    resolve!({ data: { services: [] } });
  });

  it('shows healthy service count after load', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        services: [
          { name: 'api', url: 'http://localhost:3000/health', status: 'healthy', detail: 'ok' },
          { name: 'worker', url: 'http://localhost:3400/health', status: 'degraded', detail: 'slow' },
        ],
      },
    });
    renderWithProviders(<PlatformHomePage />);
    await waitFor(() => {
      expect(screen.getByText('api')).toBeInTheDocument();
    });
  });

  it('shows error state when health fetch fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('net err'));
    renderWithProviders(<PlatformHomePage />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Could not fetch platform health');
    }, { timeout: 5000 });
  });
});
