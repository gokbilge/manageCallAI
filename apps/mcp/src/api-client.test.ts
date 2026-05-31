import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiCall', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('sends the configured API key in the Authorization header', async () => {
    vi.stubEnv('MANAGECALL_API_URL', 'https://api.example.test/');
    vi.stubEnv('MANAGECALL_API_KEY', 'mcp-key');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'f1' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiCall, apiKey } = await import('./api-client.js');
    const result = await apiCall<{ data: unknown[] }>('GET', '/api/v1/ivr-flows');

    expect(apiKey).toBe('mcp-key');
    expect(result).toEqual({ ok: true, status: 200, data: { data: [{ id: 'f1' }] } });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/ivr-flows',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mcp-key',
        },
        body: undefined,
      }),
    );
  });

  it('serializes mutation bodies and preserves API error payloads', async () => {
    vi.stubEnv('MANAGECALL_API_KEY', 'mcp-key');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'PERMISSION_DENIED' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiCall } = await import('./api-client.js');
    const result = await apiCall('POST', '/api/v1/ivr-flows', { name: 'Main' });

    expect(result).toEqual({ ok: false, status: 403, data: { error: 'PERMISSION_DENIED' } });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/ivr-flows$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Main' }),
      }),
    );
  });
});
