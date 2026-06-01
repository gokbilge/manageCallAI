import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type PropsWithChildren } from 'react';
import {
  useSecurityAlerts,
  useAlertRules,
  useAcknowledgeAlert,
  useResolveAlert,
  useDismissAlert,
  useDeleteAlertRule,
} from './security-alerts-api';

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

describe('useSecurityAlerts', () => {
  it('fetches alerts and returns data', async () => {
    const alerts = [{ id: 'a1', status: 'new' }];
    vi.mocked(apiRequest).mockResolvedValue({ data: alerts });
    const { result } = renderHook(() => useSecurityAlerts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(alerts);
    expect(apiRequest).toHaveBeenCalledWith('/observability/security/alerts', expect.objectContaining({ accessToken: 'test-token' }));
  });

  it('appends status filter to query param', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useSecurityAlerts('acknowledged'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiRequest).toHaveBeenCalledWith('/observability/security/alerts?status=acknowledged', expect.anything());
  });
});

describe('useAlertRules', () => {
  it('fetches rules', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [{ id: 'r1' }] });
    const { result } = renderHook(() => useAlertRules(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useAcknowledgeAlert', () => {
  it('posts to the acknowledge endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper: makeWrapper() });
    await result.current.mutateAsync('alert-1');
    expect(apiRequest).toHaveBeenCalledWith('/observability/security/alerts/alert-1/acknowledge', expect.objectContaining({ method: 'POST' }));
  });
});

describe('useResolveAlert', () => {
  it('posts to the resolve endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const { result } = renderHook(() => useResolveAlert(), { wrapper: makeWrapper() });
    await result.current.mutateAsync('alert-2');
    expect(apiRequest).toHaveBeenCalledWith('/observability/security/alerts/alert-2/resolve', expect.objectContaining({ method: 'POST' }));
  });
});

describe('useDismissAlert', () => {
  it('posts to the dismiss endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const { result } = renderHook(() => useDismissAlert(), { wrapper: makeWrapper() });
    await result.current.mutateAsync('alert-3');
    expect(apiRequest).toHaveBeenCalledWith('/observability/security/alerts/alert-3/dismiss', expect.objectContaining({ method: 'POST' }));
  });
});

describe('useDeleteAlertRule', () => {
  it('sends DELETE to the alert-rules endpoint', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const { result } = renderHook(() => useDeleteAlertRule(), { wrapper: makeWrapper() });
    await result.current.mutateAsync('rule-1');
    expect(apiRequest).toHaveBeenCalledWith('/observability/security/alert-rules/rule-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
