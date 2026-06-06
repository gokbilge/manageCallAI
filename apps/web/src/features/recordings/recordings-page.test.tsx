import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';
import { RecordingsPage } from './recordings-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

describe('RecordingsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows available recordings with playback link', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        data: [{
          id: '00000000-0000-0000-0000-000000000001',
          call_id: 'call-1',
          duration_secs: 42,
          size_bytes: 1024,
          status: 'available',
          recorded_at: '2026-05-30T10:00:00.000Z',
          created_at: '2026-05-30T10:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({
        data: {
          resource_type: 'recording',
          resource_id: '00000000-0000-0000-0000-000000000001',
          call_id: 'call-1',
          linked_recording_id: '00000000-0000-0000-0000-000000000001',
          analysis_request_id: '00000000-0000-0000-0000-000000000010',
          status: 'completed',
          transcript_status: null,
          summary_status: 'completed',
          source_mode: 'deterministic',
          provider_hint: 'auto',
          reason: null,
          summary_text: 'Caller requested a callback.',
          transcript_text: null,
          transcript_access: 'restricted',
          can_view_transcript: false,
          language: 'en',
          requested_outputs: ['summary'],
          completed_at: '2026-05-30T10:01:00.000Z',
          provider_metadata: {},
        },
      });

    renderWithProviders(<RecordingsPage />);

    await waitFor(() => {
      expect(screen.getByText('call-1')).toBeInTheDocument();
    });
    expect(screen.getByText('42s')).toBeInTheDocument();
    expect(await screen.findByText(/Caller requested a callback/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'http://localhost:3000/api/v1/recordings/00000000-0000-0000-0000-000000000001/playback',
    );
  });

  it('shows empty state when no recordings exist', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<RecordingsPage />);

    await waitFor(() => {
      expect(screen.getByText('No recordings yet')).toBeInTheDocument();
    });
  });
});
