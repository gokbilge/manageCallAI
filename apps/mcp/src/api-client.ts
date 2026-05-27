const apiBase = (process.env.MANAGECALL_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const apiKey = process.env.MANAGECALL_API_KEY ?? '';

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function apiCall<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}
