import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { FeatureCodesPage } from './feature-codes-page';
import { apiRequest, ApiError } from '@/lib/api/client';

const mockUseAuth = vi.fn();

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const draftFeatureCode = {
  id: 'fc-1',
  tenant_id: 'tenant-1',
  code: '*72',
  name: 'Enable Forward',
  description: 'Enable forwarding',
  action_type: 'call_forward_enable' as const,
  action_config: { prompt: 'Enter target number' },
  status: 'draft' as const,
  requires_approval: false,
  created_by: 'user-1',
  created_at: '2026-06-04T10:00:00Z',
  updated_at: '2026-06-04T10:00:00Z',
  published_at: null,
};

function setRole(role: 'tenant_admin' | 'tenant_operator' | 'tenant_viewer') {
  mockUseAuth.mockReturnValue({
    session: {
      token: 'test-token',
      claims: {
        tenant_id: 'tenant-1',
        role,
      },
    },
  });
}

describe('FeatureCodesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('tenant_admin');
  });

  it('renders the heading and loaded inventory', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [draftFeatureCode] });

    renderWithProviders(<FeatureCodesPage />);

    expect(screen.getByText('Feature Codes')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Enable Forward')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('*72')).toBeInTheDocument();
  });

  it('creates a new draft and sends JSON config to the API', async () => {
    let featureCodes = [draftFeatureCode];

    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/feature-codes' && (!options?.method || options.method === 'GET')) {
        return { data: featureCodes };
      }

      if (path === '/feature-codes' && options?.method === 'POST') {
        const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
        const created = {
          ...draftFeatureCode,
          id: 'fc-2',
          code: payload.code as string,
          name: payload.name as string,
          action_type: payload.action_type as typeof draftFeatureCode.action_type,
          action_config: payload.action_config as typeof draftFeatureCode.action_config,
        };
        featureCodes = [created, ...featureCodes];
        return { data: created };
      }

      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<FeatureCodesPage />);

    await screen.findByText('Enable Forward');
    fireEvent.click(screen.getByRole('button', { name: /new draft/i }));

    fireEvent.change(screen.getByLabelText('DTMF Code'), { target: { value: '*73' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Park Call' } });
    fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'call_park' } });
    fireEvent.change(screen.getByLabelText('Action Config JSON'), { target: { value: '{"slot":"701"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/feature-codes', expect.objectContaining({
        method: 'POST',
        accessToken: 'test-token',
      }));
    });

    const [, requestOptions] = vi.mocked(apiRequest).mock.calls.find(
      ([path, options]) => path === '/feature-codes' && options?.method === 'POST',
    )!;
    expect(JSON.parse(String(requestOptions!.body))).toMatchObject({
      code: '*73',
      name: 'Park Call',
      action_type: 'call_park',
      action_config: { slot: '701' },
    });
  });

  it('shows read-only guidance for tenant_viewer', async () => {
    setRole('tenant_viewer');
    vi.mocked(apiRequest).mockResolvedValue({ data: [draftFeatureCode] });

    renderWithProviders(<FeatureCodesPage />);

    await screen.findByText('Enable Forward');
    expect(screen.queryByRole('button', { name: /new draft/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only for feature codes/i)).toBeInTheDocument();
  });

  it('runs validate, publish, and disable actions for tenant_admin', async () => {
    let featureCodes = [draftFeatureCode];

    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/feature-codes' && (!options?.method || options.method === 'GET')) {
        return { data: featureCodes };
      }

      if (path === '/feature-codes/fc-1/validate' && options?.method === 'POST') {
        return { data: { valid: true, errors: [] } };
      }

      if (path === '/feature-codes/fc-1/publish' && options?.method === 'POST') {
        featureCodes = [{
          ...draftFeatureCode,
          status: 'active' as typeof draftFeatureCode.status,
          published_at: '2026-06-04T11:00:00Z' as unknown as typeof draftFeatureCode.published_at,
        }];
        return { data: featureCodes[0] };
      }

      if (path === '/feature-codes/fc-1/disable' && options?.method === 'POST') {
        featureCodes = [{
          ...featureCodes[0]!,
          status: 'disabled' as typeof draftFeatureCode.status,
        }];
        return { data: featureCodes[0] };
      }

      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<FeatureCodesPage />);

    await screen.findByText('Enable Forward');

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await screen.findByText('Validation passed');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => {
      expect(screen.getByText('Immutable lifecycle state')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });

  it('surfaces emergency-number conflicts clearly', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/feature-codes' && (!options?.method || options.method === 'GET')) {
        return { data: [] };
      }

      if (path === '/feature-codes' && options?.method === 'POST') {
        throw new ApiError('Feature code 911 shadows an emergency number and cannot be used', 400);
      }

      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<FeatureCodesPage />);

    await screen.findByText('No feature codes yet');
    fireEvent.click(screen.getByRole('button', { name: /new draft/i }));
    fireEvent.change(screen.getByLabelText('DTMF Code'), { target: { value: '911' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad Code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));

    await waitFor(() => {
      expect(screen.getByText('Conflict or lifecycle check')).toBeInTheDocument();
    });
    expect(screen.getByText(/shadows an emergency number/i)).toBeInTheDocument();
  });
});
