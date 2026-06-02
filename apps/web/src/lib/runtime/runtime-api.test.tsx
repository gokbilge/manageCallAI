import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRuntimeSessionReplay, useRuntimeSessions } from './runtime-api';

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
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } });
  return ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } } } as never);
});

describe('runtime API hooks', () => {
  it('fetches all runtime sessions without a status filter', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: 's1', status: 'running' }] });

    const { result } = renderHook(() => useRuntimeSessions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/runtime/ivr/sessions', { accessToken: 'test-token' });
  });

  it('encodes the runtime session status filter', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useRuntimeSessions('completed'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/runtime/ivr/sessions?status=completed', {
      accessToken: 'test-token',
    });
  });

  it('keeps runtime sessions idle without a token', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null } as never);

    const { result } = renderHook(() => useRuntimeSessions('failed'), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not retry authorization failures', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new MockApiError(403));

    const { result } = renderHook(() => useRuntimeSessions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('fetches replay details only when a session id is present', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { session: { id: 's1' }, steps: [], call_events: [] } });

    const { result, rerender } = renderHook(({ id }) => useRuntimeSessionReplay(id), {
      initialProps: { id: '' },
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequest).not.toHaveBeenCalled();

    rerender({ id: 's1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/runtime/ivr/sessions/s1', { accessToken: 'test-token' });
  });
});
