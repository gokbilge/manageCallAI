/**
 * DEPRECATION NOTICE — apps/mcp-server
 *
 * This server previously required an access_token as a tool argument in every
 * call. That pattern has been removed: credentials must never appear in tool
 * arguments because they are exposed to LLM context, logs, and session
 * transcripts.
 *
 * Authentication now uses MANAGECALL_API_KEY from the environment, matching
 * the canonical apps/mcp server. For new integrations use apps/mcp instead.
 * apps/mcp-server is retained for its Docker image tag compatibility only.
 * No new tools should be added here.
 */

import { config } from '../config/env.js';

async function callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export function fetchJson<T>(path: string): Promise<T> {
  return callApi<T>('GET', path);
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return callApi<T>('POST', path, body ?? {});
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return callApi<T>('PATCH', path, body);
}
