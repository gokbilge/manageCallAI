import { describe, expect, it } from 'vitest';
import { ManageCallApiClient } from './client.js';

describe('ManageCallApiClient', () => {
  it('uses generated OpenAPI paths for auth, extension, IVR, publish, and runtime calls', async () => {
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
      if (url.endsWith('/ivr-flows')) {
        return jsonResponse({
          data: {
            id: '00000000-0000-0000-0000-000000000010',
            tenant_id: '00000000-0000-0000-0000-000000000002',
            name: 'Main IVR',
            description: null,
            status: 'draft',
            draft_version_id: '00000000-0000-0000-0000-000000000011',
            active_version_id: null,
            created_at: '2026-05-30T00:00:00.000Z',
            updated_at: '2026-05-30T00:00:00.000Z',
          },
        }, 201);
      }
      if (url.endsWith('/ivr-flows/00000000-0000-0000-0000-000000000010/validate')) {
        return jsonResponse({
          data: {
            flow_id: '00000000-0000-0000-0000-000000000010',
            version_id: '00000000-0000-0000-0000-000000000011',
            outcome: { status: 'passed', errors: [], warnings: [] },
            version: { state: 'validated' },
          },
        });
      }
      if (url.endsWith('/ivr-flows/00000000-0000-0000-0000-000000000010/simulate')) {
        return jsonResponse({
          data: {
            flow_id: '00000000-0000-0000-0000-000000000010',
            version_id: '00000000-0000-0000-0000-000000000011',
            scenario: {},
            outcome: { status: 'passed', path: ['start', 'end'], steps: [] },
          },
        });
      }
      if (url.endsWith('/ivr-flows/00000000-0000-0000-0000-000000000010/versions/00000000-0000-0000-0000-000000000011/publish')) {
        return jsonResponse({
          data: {
            status: 'published',
            flow: {
              id: '00000000-0000-0000-0000-000000000010',
              active_version_id: '00000000-0000-0000-0000-000000000011',
            },
            approval_request: null,
          },
        });
      }
      if (url.endsWith('/runtime/ivr/sessions/00000000-0000-0000-0000-000000000099')) {
        return jsonResponse({
          data: {
            session: {
              id: '00000000-0000-0000-0000-000000000099',
              tenant_id: '00000000-0000-0000-0000-000000000002',
              call_id: 'call-1',
              flow_id: '00000000-0000-0000-0000-000000000010',
              flow_version_id: '00000000-0000-0000-0000-000000000011',
              current_node_id: 'end',
              status: 'completed',
              caller_number: '+15551234567',
              started_at: '2026-05-30T00:00:00.000Z',
              completed_at: '2026-05-30T00:01:00.000Z',
              context: {},
              created_at: '2026-05-30T00:00:00.000Z',
              updated_at: '2026-05-30T00:01:00.000Z',
            },
            steps: [],
            call_events: [],
          },
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
    const flow = await client.createIvrFlow({
      name: 'Main IVR',
      graph_json: { entry_node_id: 'start', nodes: [{ id: 'start', type: 'hangup' }] },
    }, { accessToken: auth.token });
    const validation = await client.validateIvrFlow(flow.id, { accessToken: auth.token });
    const simulation = await client.simulateIvrFlow(flow.id, {}, { accessToken: auth.token });
    const publish = await client.publishIvrFlowVersion(
      flow.id,
      '00000000-0000-0000-0000-000000000011',
      { accessToken: auth.token },
    );
    const replay = await client.getRuntimeSessionReplay(
      '00000000-0000-0000-0000-000000000099',
      { accessToken: auth.token },
    );

    expect(auth.token).toBe('jwt-token');
    expect(extensions).toHaveLength(1);
    expect(validation.outcome.status).toBe('passed');
    expect(simulation.outcome.path).toEqual(['start', 'end']);
    expect(publish.status).toBe('published');
    expect(replay.session.call_id).toBe('call-1');
    expect(requests).toEqual([
      { url: 'https://api.example.test/api/v1/auth/register', method: 'POST', authorization: undefined },
      { url: 'https://api.example.test/api/v1/extensions', method: 'GET', authorization: 'Bearer jwt-token' },
      { url: 'https://api.example.test/api/v1/ivr-flows', method: 'POST', authorization: 'Bearer jwt-token' },
      { url: 'https://api.example.test/api/v1/ivr-flows/00000000-0000-0000-0000-000000000010/validate', method: 'POST', authorization: 'Bearer jwt-token' },
      { url: 'https://api.example.test/api/v1/ivr-flows/00000000-0000-0000-0000-000000000010/simulate', method: 'POST', authorization: 'Bearer jwt-token' },
      { url: 'https://api.example.test/api/v1/ivr-flows/00000000-0000-0000-0000-000000000010/versions/00000000-0000-0000-0000-000000000011/publish', method: 'POST', authorization: 'Bearer jwt-token' },
      { url: 'https://api.example.test/api/v1/runtime/ivr/sessions/00000000-0000-0000-0000-000000000099', method: 'GET', authorization: 'Bearer jwt-token' },
    ]);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
