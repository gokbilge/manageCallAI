import { describe, expect, it } from 'vitest';
import { ManageCallApiClient } from './client.js';

describe('ManageCallApiClient', () => {
  it('uses generated OpenAPI paths for auth and extension calls', async () => {
    const requests: Array<{ url: string; method: string; authorization?: string }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      requests.push({ url, method, authorization: headers.get('authorization') ?? undefined });

      if (url.endsWith('/auth/register')) {
        return jsonResponse({ token: 'jwt-token' }, 201);
      }
      if (url.endsWith('/extensions')) {
        return jsonResponse({
          data: [{
            id: '00000000-0000-0000-0000-000000000001',
            tenant_id: '00000000-0000-0000-0000-000000000002',
            extension_number: '200',
            display_name: 'Reception',
            sip_username: '200',
            status: 'active',
            created_at: '2026-05-30T00:00:00.000Z',
            updated_at: '2026-05-30T00:00:00.000Z',
          }],
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    };

    const client = new ManageCallApiClient({ baseUrl: 'https://api.example.test/api/v1', fetch: fetchMock });
    const auth = await client.register({
      tenant_name: 'Acme',
      tenant_slug: 'acme',
      email: 'owner@example.com',
      display_name: 'Owner',
      password: 'Secret123!',
    });
    const extensions = await client.listExtensions({ accessToken: auth.token });

    expect(auth.token).toBe('jwt-token');
    expect(extensions).toHaveLength(1);
    expect(requests).toEqual([
      { url: 'https://api.example.test/api/v1/auth/register', method: 'POST', authorization: undefined },
      { url: 'https://api.example.test/api/v1/extensions', method: 'GET', authorization: 'Bearer jwt-token' },
    ]);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
