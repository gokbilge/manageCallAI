import { config } from '../config/env.js';

async function callApi<T>(method: string, path: string, accessToken: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export function fetchJson<T>(path: string, accessToken: string): Promise<T> {
  return callApi<T>('GET', path, accessToken);
}

export function postJson<T>(path: string, accessToken: string, body?: unknown): Promise<T> {
  return callApi<T>('POST', path, accessToken, body ?? {});
}

export function patchJson<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  return callApi<T>('PATCH', path, accessToken, body);
}
