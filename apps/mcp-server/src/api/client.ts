import { config } from '../config/env.js';

export async function fetchJson<T>(path: string, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, { headers });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
