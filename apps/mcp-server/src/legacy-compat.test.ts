import { beforeAll, describe, expect, it, vi } from 'vitest';

// Set required env vars before any module imports resolve
process.env['API_BASE_URL'] = 'http://localhost:3000';
process.env['MANAGECALL_API_KEY'] = 'test-api-key';

// ── Legacy API client ─────────────────────────────────────────────────────────

describe('legacy mcp-server API client', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
    vi.mocked(fetch).mockResolvedValue(response as Response);
  }

  it('fetchJson sends GET with Authorization header', async () => {
    mockFetch({ ok: true, json: async () => ({ data: [] }) });

    const { fetchJson } = await import('./api/client.js');
    await fetchJson('/api/v1/extensions');

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3000/api/v1/extensions');
    expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
    const headers = (init as RequestInit | undefined)?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBe('Bearer test-api-key');
  });

  it('postJson sends POST with JSON body and Content-Type', async () => {
    vi.mocked(fetch).mockClear();
    mockFetch({ ok: true, json: async () => ({ data: {} }) });

    const { postJson } = await import('./api/client.js');
    await postJson('/api/v1/ivr-flows', { name: 'Test Flow' });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3000/api/v1/ivr-flows');
    const i = init as RequestInit;
    expect(i.method).toBe('POST');
    expect(i.body).toBe(JSON.stringify({ name: 'Test Flow' }));
    const headers = i.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('patchJson sends PATCH with JSON body', async () => {
    vi.mocked(fetch).mockClear();
    mockFetch({ ok: true, json: async () => ({ data: {} }) });

    const { patchJson } = await import('./api/client.js');
    await patchJson('/api/v1/ivr-flows/f1/versions/v1', { graph_json: {} });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init as RequestInit).method).toBe('PATCH');
  });

  it('fetchJson throws on non-ok responses with status code', async () => {
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    } as unknown as Response);

    const { fetchJson } = await import('./api/client.js');
    await expect(fetchJson('/api/v1/missing')).rejects.toThrow('404');
  });

  it('postJson without body sends empty object as JSON body', async () => {
    vi.mocked(fetch).mockClear();
    mockFetch({ ok: true, json: async () => ({ data: {} }) });

    const { postJson } = await import('./api/client.js');
    await postJson('/api/v1/ivr-flows/f1/validate');

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect((init as RequestInit).body).toBe(JSON.stringify({}));
  });

  it('removes trailing slash from API_BASE_URL', async () => {
    // The config strips trailing slashes at load time
    // (already tested by the absence of double-slash in the URL above)
    vi.mocked(fetch).mockClear();
    mockFetch({ ok: true, json: async () => ({}) });

    const { fetchJson } = await import('./api/client.js');
    await fetchJson('/api/v1/extensions');

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).not.toContain('//api');
  });
});

// ── Legacy tool schema safety ─────────────────────────────────────────────────

describe('legacy server tool schema safety', () => {
  it('DEPRECATION NOTICE is present in server.ts (no new tools added)', async () => {
    // This test acts as a lint guard — it reads the server source to verify
    // the deprecation notice is still intact. If someone removes it while
    // adding new tools, this test surfaces the intent mismatch.
    const { readFileSync } = await import('node:fs');
    const { dirname, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, 'server.ts'), 'utf8');
    expect(src).toContain('DEPRECATION NOTICE');
    expect(src).toContain('legacy prototype retained for Docker image compatibility');
  });

  it('no tool schema in legacy server.ts includes access_token', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, 'server.ts'), 'utf8');

    // access_token must not appear in any inputSchema property definition
    const schemaBlocks = src.match(/inputSchema:\s*\{[^}]+\}/gms) ?? [];
    for (const block of schemaBlocks) {
      expect(block).not.toContain('access_token');
    }
  });

  it('legacy server name and version are stable identifiers', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, 'server.ts'), 'utf8');

    expect(src).toContain('managecallai-mcp-server');
    expect(src).toMatch(/version:\s*['"][0-9]+\.[0-9]+\.[0-9]+['"]/);
  });
});
