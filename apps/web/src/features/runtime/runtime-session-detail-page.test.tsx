import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeSessionDetailPage } from './runtime-session-detail-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

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

describe('RuntimeSessionDetailPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders replay payload', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        session: {
          id: 'session-1',
          call_id: 'call-1',
          flow_id: 'flow-1',
          status: 'completed',
          current_node_id: null,
          caller_number: '+905551112233',
          created_at: '2026-05-29T10:00:00.000Z',
          completed_at: '2026-05-29T10:01:00.000Z',
        },
        steps: [],
        call_events: [],
      },
    });

    renderWithProviders(
      <Routes>
        <Route path="/tenant/runtime/sessions/:sessionId" element={<RuntimeSessionDetailPage />} />
      </Routes>,
      { route: '/tenant/runtime/sessions/session-1' },
    );

    await waitFor(() => {
      expect(screen.getByText('call-1')).toBeInTheDocument();
    });
  });
});
