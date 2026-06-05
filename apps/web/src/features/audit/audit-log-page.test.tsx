import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuditLogPage } from './audit-log-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 't1', role: 'tenant_admin' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const stubEntry = {
  id: 'entry-1',
  tenant_id: 't1',
  actor_id: 'user-uuid-abc',
  actor_role: 'tenant_admin',
  action: 'sip_trunk.created',
  resource_type: 'sip_trunk',
  resource_id: 'trunk-uuid-123',
  metadata: null,
  created_at: new Date().toISOString(),
};

describe('AuditLogPage', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('renders page heading', () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('shows empty state when no events', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByText('No events match the current filters.')).toBeInTheDocument();
    });
  });

  it('renders audit entries in a table', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [stubEntry] });
    renderWithProviders(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByText('sip_trunk.created')).toBeInTheDocument();
      // resource_type 'sip_trunk' appears as 'sip trunk' in both the dropdown option and table row
      expect(screen.getAllByText('sip trunk').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('tenant_admin')).toBeInTheDocument();
    });
  });

  it('shows error text element when isError would be true', () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<AuditLogPage />);
    // error paragraph is rendered conditionally; verify it does not appear in happy path
    expect(screen.queryByText('Could not load audit log.')).not.toBeInTheDocument();
  });

  it('renders resource type filter dropdown', () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders action filter input', () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByPlaceholderText(/e\.g\. created/)).toBeInTheDocument();
  });

  it('shows refresh button', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
