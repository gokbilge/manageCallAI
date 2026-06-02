import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreatePhoneNumber, useDeactivatePhoneNumber, usePhoneNumbers } from './phone-numbers-api';

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
  useAuth: vi.fn(() => ({ session: { token: 'test-token' } })),
}));

import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 }, mutations: { retry: false } } });
  return ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ session: { token: 'test-token' } } as never);
});

describe('phone number API hooks', () => {
  it('fetches phone numbers', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: 'pn1', e164_number: '+15551230000' }] });

    const { result } = renderHook(() => usePhoneNumbers(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.e164_number).toBe('+15551230000');
    expect(apiRequest).toHaveBeenCalledWith('/phone-numbers', { accessToken: 'test-token' });
  });

  it('keeps the query idle without a token', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null } as never);

    const { result } = renderHook(() => usePhoneNumbers(), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not retry unauthenticated responses', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new MockApiError(401));

    const { result } = renderHook(() => usePhoneNumbers(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('creates and deactivates phone numbers', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: 'pn1' } });
    const wrapper = makeWrapper();

    await renderHook(() => useCreatePhoneNumber(), { wrapper }).result.current.mutateAsync({
      e164_number: '+15551230000',
      display_label: 'Main',
    });
    await renderHook(() => useDeactivatePhoneNumber(), { wrapper }).result.current.mutateAsync('pn1');

    expect(apiRequest).toHaveBeenCalledWith('/phone-numbers', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ e164_number: '+15551230000', display_label: 'Main' }),
      accessToken: 'test-token',
    }));
    expect(apiRequest).toHaveBeenCalledWith('/phone-numbers/pn1/deactivate', expect.objectContaining({
      method: 'POST',
      accessToken: 'test-token',
    }));
  });
});
