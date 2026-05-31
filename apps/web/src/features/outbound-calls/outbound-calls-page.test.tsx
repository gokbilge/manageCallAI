import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';
import { OutboundCallsPage } from './outbound-calls-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

describe('OutboundCallsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows outbound call requests and terminal failure reason', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [{
        id: 'call-request-1',
        extension_id: '00000000-0000-0000-0000-000000000001',
        dial_number: '+905551234567',
        route_id: null,
        sip_trunk_id: null,
        status: 'failed',
        failure_reason: 'carrier rejected',
        created_at: '2026-05-30T10:00:00.000Z',
        updated_at: '2026-05-30T10:01:00.000Z',
      }],
    });

    renderWithProviders(<OutboundCallsPage />);

    await waitFor(() => {
      expect(screen.getByText('+905551234567')).toBeInTheDocument();
    });
    expect(screen.getByText('carrier rejected')).toBeInTheDocument();
  });

  it('shows empty state when no outbound calls exist', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<OutboundCallsPage />);

    await waitFor(() => {
      expect(screen.getByText('No outbound call requests yet')).toBeInTheDocument();
    });
  });
});
