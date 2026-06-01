import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type PropsWithChildren } from 'react';
import {
  useRetentionPolicy,
  useUpdateRetentionPolicy,
  useLegalHolds,
  useCreateLegalHold,
  useReleaseLegalHold,
} from './compliance-api';

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: vi.fn(() => ({ session: { token: 'test-token' } })),
}));

import { apiRequest } from '@/lib/api/client';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => vi.clearAllMocks());

describe('useRetentionPolicy', () => {
  it('fetches the retention policy', async () => {
    const policy = { id: 'p1', recording_retention_days: 90 };
    vi.mocked(apiRequest).mockResolvedValue({ data: policy });
    const { result } = renderHook(() => useRetentionPolicy(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject(policy);
    expect(apiRequest).toHaveBeenCalledWith('/recordings/retention-policy', expect.anything());
  });
});

describe('useUpdateRetentionPolicy', () => {
  it('puts the updated policy', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: 'p1' } });
    const { result } = renderHook(() => useUpdateRetentionPolicy(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ recording_retention_days: 30 });
    expect(apiRequest).toHaveBeenCalledWith('/recordings/retention-policy', expect.objectContaining({ method: 'PUT' }));
  });
});

describe('useLegalHolds', () => {
  it('fetches active holds', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: 'h1' }] });
    const { result } = renderHook(() => useLegalHolds('active'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/recordings/legal-holds?status=active', expect.anything());
  });

  it('fetches all holds when no status given', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useLegalHolds(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/recordings/legal-holds', expect.anything());
  });
});

describe('useCreateLegalHold', () => {
  it('posts a new legal hold', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const { result } = renderHook(() => useCreateLegalHold(), { wrapper: makeWrapper() });
    await result.current.mutateAsync({ resource_type: 'recording', reason: 'Legal' });
    expect(apiRequest).toHaveBeenCalledWith('/recordings/legal-holds', expect.objectContaining({ method: 'POST' }));
  });
});

describe('useReleaseLegalHold', () => {
  it('posts to the release endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const { result } = renderHook(() => useReleaseLegalHold(), { wrapper: makeWrapper() });
    await result.current.mutateAsync('hold-1');
    expect(apiRequest).toHaveBeenCalledWith('/recordings/legal-holds/hold-1/release', expect.objectContaining({ method: 'POST' }));
  });
});
