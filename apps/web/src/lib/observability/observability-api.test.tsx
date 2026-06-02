import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveSnapshot, useObservabilityStream } from './observability-api';

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

function streamResponse(chunks: string[], { stayOpen = false } = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  let cancelled = false;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          if (index >= chunks.length && stayOpen && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 10_000));
          }
          if (index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: encoder.encode(chunks[index++]) };
        }),
        cancel: vi.fn(async () => {
          cancelled = true;
        }),
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(useAuth).mockReturnValue({ session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } } } as never);
});

describe('useLiveSnapshot', () => {
  it('fetches the live snapshot with the current token', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { tenant_id: 'tenant-1', active_session_count: 2 } });

    const { result } = renderHook(() => useLiveSnapshot(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.active_session_count).toBe(2);
    expect(apiRequest).toHaveBeenCalledWith('/observability/snapshot', { accessToken: 'test-token' });
  });

  it('keeps the snapshot query idle without a token', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null } as never);

    const { result } = renderHook(() => useLiveSnapshot(), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not retry authorization failures', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new MockApiError(401));

    const { result } = renderHook(() => useLiveSnapshot(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});

describe('useObservabilityStream', () => {
  it('stays offline without a token', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null } as never);

    const { result } = renderHook(() => useObservabilityStream('http://api.test'));

    expect(result.current.streamStatus).toBe('offline');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('connects with bearer auth and reflects live stream status', async () => {
    vi.mocked(fetch).mockResolvedValue(streamResponse([
      'data: {"status":"live","data":null,"generated_at":"2026-06-02T00:00:00Z"}\n\n',
    ], { stayOpen: true }) as never);

    const { result, unmount } = renderHook(() => useObservabilityStream('http://api.test'));

    await waitFor(() => expect(result.current.streamStatus).toBe('live'));
    expect(fetch).toHaveBeenCalledWith('http://api.test/observability/stream', expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
      signal: expect.any(AbortSignal),
    }));
    unmount();
  });

  it('marks degraded events as degraded', async () => {
    vi.mocked(fetch).mockResolvedValue(streamResponse([
      'data: {"status":"degraded","data":null,"generated_at":"2026-06-02T00:00:00Z"}\n\n',
    ], { stayOpen: true }) as never);

    const { result, unmount } = renderHook(() => useObservabilityStream('http://api.test'));

    await waitFor(() => expect(result.current.streamStatus).toBe('degraded'));
    unmount();
  });

  it('goes offline on non-ok responses and malformed stream chunks', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, body: null } as never)
      .mockResolvedValueOnce(streamResponse(['data: not-json\n\n']) as never);

    const first = renderHook(() => useObservabilityStream('http://api.test'));
    await waitFor(() => expect(first.result.current.streamStatus).toBe('offline'));
    first.unmount();

    const second = renderHook(() => useObservabilityStream('http://api.test'));
    await act(async () => undefined);
    expect(second.result.current.streamStatus).toBe('offline');
  });

  it('goes offline when fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useObservabilityStream('http://api.test'));

    await waitFor(() => expect(result.current.streamStatus).toBe('offline'));
  });
});
