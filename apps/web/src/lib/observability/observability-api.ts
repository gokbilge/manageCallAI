import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type RunningSession = {
  id: string;
  call_id: string;
  flow_id: string;
  caller_number: string | null;
  current_node_id: string | null;
  started_at: string;
};

export type QueueDepth = {
  queue_id: string;
  queue_name: string;
  member_count: number;
};

export type WebhookBacklog = {
  pending: number;
  processing: number;
  failed: number;
  abandoned: number;
};

export type LiveSnapshot = {
  tenant_id: string;
  active_session_count: number;
  running_sessions: RunningSession[];
  queue_depths: QueueDepth[];
  webhook_backlog: WebhookBacklog;
  recent_call_events_5m: number;
  recent_session_failures_1h: number;
  pending_approvals: number;
  generated_at: string;
};

export type StreamStatus = 'live' | 'degraded' | 'offline';

export type StreamEvent = {
  status: 'live' | 'degraded';
  data: LiveSnapshot | null;
  generated_at: string;
};

function noRetryOnAuthError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
  return failureCount < 1;
}

/** Polls the live snapshot endpoint every 5 seconds. */
export function useLiveSnapshot() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['observability-snapshot', session?.claims.tenant_id],
    queryFn: async (): Promise<LiveSnapshot> => {
      const result = await apiRequest<{ data: LiveSnapshot }>('/observability/snapshot', {
        accessToken: session?.token,
      });
      return result.data;
    },
    enabled: Boolean(session?.token),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: noRetryOnAuthError,
  });
}

/**
 * Connects to the SSE stream and tracks the live stream status.
 *
 * Returns:
 * - `streamStatus`: 'live' | 'degraded' | 'offline'
 *   - live: SSE connected and returning fresh snapshots
 *   - degraded: SSE connected but server reports it cannot fetch fresh data
 *   - offline: SSE connection is not established or has been closed
 *
 * Stream authentication: Bearer token is sent via an Authorization header
 * using the Fetch API (not native EventSource which cannot set headers).
 *
 * Tenant isolation: the token's tenant_id gates which data the server returns.
 */
export function useObservabilityStream(apiBase: string): { streamStatus: StreamStatus } {
  const { session } = useAuth();
  const accessToken = session?.token;
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('offline');
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setStreamStatus('offline');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let active = true;

    async function connect() {
      try {
        const response = await fetch(`${apiBase}/observability/stream`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setStreamStatus('offline');
          return;
        }

        const reader = response.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = '';

        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';
          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine.slice(6)) as StreamEvent;
              setStreamStatus(event.status === 'live' ? 'live' : 'degraded');
            } catch {
              // ignore malformed SSE data
            }
          }
        }
        setStreamStatus('offline');
      } catch {
        if (active) setStreamStatus('offline');
      }
    }

    void connect();

    return () => {
      active = false;
      controller.abort();
      readerRef.current?.cancel().catch(() => {});
    };
  }, [accessToken, apiBase]);

  return { streamStatus };
}
