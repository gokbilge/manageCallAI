import { config } from '../config/env.js';

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  authorization?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
