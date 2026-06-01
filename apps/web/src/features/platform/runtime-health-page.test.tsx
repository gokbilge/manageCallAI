import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RuntimeHealthPage } from './runtime-health-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { role: 'platform_admin' } } }),
}));
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});
import { apiRequest } from '@/lib/api/client';

const healthData = {
  services: [
    { name: 'api', url: 'http://api/health', status: 'healthy', detail: 'ok' },
    { name: 'worker', url: 'http://worker/health', status: 'degraded', detail: 'slow' },
  ],
};
const summaryData = {
  active_sessions: 3,
  completed_sessions_24h: 42,
  failed_sessions_24h: 1,
  call_events_24h: 128,
  failed_runtime_ingestions_24h: 0,
  pending_approvals: 0,
};

describe('RuntimeHealthPage', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders page title', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: healthData });
    renderWithProviders(<RuntimeHealthPage />);
    expect(screen.getByText('Runtime Health')).toBeInTheDocument();
  });

  it('shows loading state for services', async () => {
    let resolve: (v: unknown) => void;
    vi.mocked(apiRequest).mockReturnValue(new Promise((r) => { resolve = r; }));
    renderWithProviders(<RuntimeHealthPage />);
    expect(screen.getByText('Checking service health…')).toBeInTheDocument();
    resolve!({ data: healthData });
  });

  it('renders service list after load', async () => {
    vi.mocked(apiRequest).mockImplementation((path: string) => {
      if (path === '/platform/runtime/health') return Promise.resolve({ data: healthData });
      if (path === '/platform/runtime/summary') return Promise.resolve({ data: summaryData });
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<RuntimeHealthPage />);
    await waitFor(() => {
      expect(screen.getByText('api')).toBeInTheDocument();
      expect(screen.getByText('worker')).toBeInTheDocument();
    });
  });

  it('shows active sessions from summary', async () => {
    vi.mocked(apiRequest).mockImplementation((path: string) => {
      if (path === '/platform/runtime/health') return Promise.resolve({ data: healthData });
      if (path === '/platform/runtime/summary') return Promise.resolve({ data: summaryData });
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<RuntimeHealthPage />);
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows error state when health fetch fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('net err'));
    renderWithProviders(<RuntimeHealthPage />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Could not fetch runtime health');
    }, { timeout: 5000 });
  });
});
