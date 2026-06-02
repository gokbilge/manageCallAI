import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useActivateRoute,
  useCreateInboundRoute,
  useDeactivateRoute,
  useInboundRoute,
  useInboundRoutes,
  usePublishRouteVersion,
  useRollbackRoute,
  useValidateRouteVersion,
} from './inbound-routes-api';

const { MockApiError } = vi.hoisted(() => ({
  MockApiError: class MockApiError extends Error {
    constructor(public status: number) {
      super(`API request failed: ${status}`);
    }
  },
}));

vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
  ApiError: MockApiError,
}));

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: vi.fn(() => ({ session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } } })),
}));

import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1 }, mutations: { retry: false } },
  });
  return ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } } } as never);
});

describe('inbound route API hooks', () => {
  it('fetches the route list with the current token', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: 'r1' }] });

    const { result } = renderHook(() => useInboundRoutes(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'r1' }]);
    expect(apiRequest).toHaveBeenCalledWith('/inbound-routes', { accessToken: 'test-token' });
  });

  it('does not fetch routes without a session token', async () => {
    vi.mocked(useAuth).mockReturnValue({ session: null } as never);

    const { result } = renderHook(() => useInboundRoutes(), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not retry authorization failures', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new MockApiError(403));

    const { result } = renderHook(() => useInboundRoutes(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('fetches one route only when an id is present', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: 'route-1', versions: [] } });

    const { result, rerender } = renderHook(({ id }) => useInboundRoute(id), {
      initialProps: { id: '' },
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequest).not.toHaveBeenCalled();

    rerender({ id: 'route-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/inbound-routes/route-1', { accessToken: 'test-token' });
  });

  it('creates a route and invalidates the route list', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: 'route-1' } });

    const { result } = renderHook(() => useCreateInboundRoute(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({
      name: 'Main DID',
      match_type: 'did',
      match_value: '+15551230000',
      target_type: 'flow',
      target_id: 'flow-1',
    });

    expect(apiRequest).toHaveBeenCalledWith('/inbound-routes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Main DID',
        match_type: 'did',
        match_value: '+15551230000',
        target_type: 'flow',
        target_id: 'flow-1',
      }),
      accessToken: 'test-token',
    }));
  });

  it('validates, publishes, rolls back, activates, and deactivates routes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: 'route-1' } });
    const wrapper = makeWrapper();

    await renderHook(() => useValidateRouteVersion('route-1'), { wrapper }).result.current.mutateAsync('version-1');
    await renderHook(() => usePublishRouteVersion('route-1'), { wrapper }).result.current.mutateAsync('version-2');
    await renderHook(() => useRollbackRoute('route-1'), { wrapper }).result.current.mutateAsync();
    await renderHook(() => useActivateRoute(), { wrapper }).result.current.mutateAsync('route-1');
    await renderHook(() => useDeactivateRoute(), { wrapper }).result.current.mutateAsync('route-1');

    expect(apiRequest).toHaveBeenCalledWith(
      '/inbound-routes/route-1/versions/version-1/validate',
      expect.objectContaining({ method: 'POST', accessToken: 'test-token' }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      '/inbound-routes/route-1/versions/version-2/publish',
      expect.objectContaining({ method: 'POST', accessToken: 'test-token' }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      '/inbound-routes/route-1/rollback',
      expect.objectContaining({ method: 'POST', accessToken: 'test-token' }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      '/inbound-routes/route-1/activate',
      expect.objectContaining({ method: 'POST', accessToken: 'test-token' }),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      '/inbound-routes/route-1/deactivate',
      expect.objectContaining({ method: 'POST', accessToken: 'test-token' }),
    );
  });
});
