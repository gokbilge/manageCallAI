import { config } from '../config/env.js';

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
