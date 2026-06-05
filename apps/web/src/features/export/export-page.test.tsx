import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExportPage } from './export-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 't1', role: 'tenant_operator' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

// URL.createObjectURL is not available in jsdom
URL.createObjectURL = vi.fn(() => 'blob:mock');
URL.revokeObjectURL = vi.fn();

const mockDownloadClick = vi.fn();

describe('ExportPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    mockDownloadClick.mockReset();
  });

  it('renders page heading', () => {
    renderWithProviders(<ExportPage />);
    expect(screen.getByText('Data Export')).toBeInTheDocument();
  });

  it('renders call events export section', () => {
    renderWithProviders(<ExportPage />);
    expect(screen.getByText('Call Events')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export call events/i })).toBeInTheDocument();
  });

  it('renders IVR sessions export section', () => {
    renderWithProviders(<ExportPage />);
    expect(screen.getByText('IVR Sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export ivr sessions/i })).toBeInTheDocument();
  });

  it('shows empty export history initially', () => {
    renderWithProviders(<ExportPage />);
    expect(screen.getByText('No exports yet. Run an export above to download data.')).toBeInTheDocument();
  });

  it('exports call events and shows history entry', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: '1' }, { id: '2' }] });
    // spy on click after render
    const origCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') { const el = origCreate(tag); el.click = mockDownloadClick; return el; }
      return origCreate(tag);
    });
    renderWithProviders(<ExportPage />);
    fireEvent.click(screen.getByRole('button', { name: /export call events/i }));
    await waitFor(() => {
      expect(screen.getByText(/2 records/)).toBeInTheDocument();
    });
    spy.mockRestore();
  });

  it('exports IVR sessions and shows history entry', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: 'sess-1' }] });
    renderWithProviders(<ExportPage />);
    fireEvent.click(screen.getByRole('button', { name: /export ivr sessions/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 record/)).toBeInTheDocument();
    });
  });

  it('shows error when call events export fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('server error'));
    renderWithProviders(<ExportPage />);
    fireEvent.click(screen.getByRole('button', { name: /export call events/i }));
    await waitFor(() => {
      expect(screen.getByText('server error')).toBeInTheDocument();
    });
  });

  it('shows error when sessions export fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('timeout'));
    renderWithProviders(<ExportPage />);
    fireEvent.click(screen.getByRole('button', { name: /export ivr sessions/i }));
    await waitFor(() => {
      expect(screen.getByText('timeout')).toBeInTheDocument();
    });
  });

  it('shows re-download button after successful export', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<ExportPage />);
    fireEvent.click(screen.getByRole('button', { name: /export call events/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /re-download/i })).toBeInTheDocument();
    });
  });

  it('renders date range inputs for call events', () => {
    renderWithProviders(<ExportPage />);
    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });
});
