import { describe, expect, it } from 'vitest';
import { ManageCallApiClient, ManageCallApiError } from './client.js';

describe('ManageCallApiClient', () => {
  it('uses generated OpenAPI paths for auth, extension, IVR, publish, and runtime calls', async () => {
    const requests: Array<{ url: string; method: string; authorization?: string; requestId?: string }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      requests.push({
        url,
        method,
        authorization: headers.get('authorization') ?? undefined,
        requestId: headers.get('x-request-id') ?? undefined,
      });

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
    const extensions = await client.listExtensions({ accessToken: auth.token, requestId: 'req-1' });
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
      {
        url: 'https://api.example.test/api/v1/auth/register',
        method: 'POST',
        authorization: undefined,
        requestId: undefined,
      },
      {
        url: 'https://api.example.test/api/v1/extensions',
        method: 'GET',
        authorization: 'Bearer jwt-token',
        requestId: 'req-1',
      },
      {
        url: 'https://api.example.test/api/v1/ivr-flows',
        method: 'POST',
        authorization: 'Bearer jwt-token',
        requestId: undefined,
      },
      {
        url: 'https://api.example.test/api/v1/ivr-flows/00000000-0000-0000-0000-000000000010/validate',
        method: 'POST',
        authorization: 'Bearer jwt-token',
        requestId: undefined,
      },
      {
        url: 'https://api.example.test/api/v1/ivr-flows/00000000-0000-0000-0000-000000000010/simulate',
        method: 'POST',
        authorization: 'Bearer jwt-token',
        requestId: undefined,
      },
      {
        url: 'https://api.example.test/api/v1/ivr-flows/00000000-0000-0000-0000-000000000010/versions/00000000-0000-0000-0000-000000000011/publish',
        method: 'POST',
        authorization: 'Bearer jwt-token',
        requestId: undefined,
      },
      {
        url: 'https://api.example.test/api/v1/runtime/ivr/sessions/00000000-0000-0000-0000-000000000099',
        method: 'GET',
        authorization: 'Bearer jwt-token',
        requestId: undefined,
      },
    ]);
  });

  it('covers login, create extension, call event query, and platform endpoints', async () => {
    const requests: Array<{ url: string; method: string; body?: unknown; authorization?: string }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const bodyText = typeof init?.body === 'string'
        ? init.body
        : input instanceof Request
          ? await input.clone().text()
          : '';
      const rawBody = bodyText ? JSON.parse(bodyText) : undefined;
      requests.push({ url, method, body: rawBody, authorization: headers.get('authorization') ?? undefined });

      if (url.endsWith('/auth/login')) {
        return jsonResponse({ token: 'login-token' });
      }
      if (url.endsWith('/extensions') && method === 'POST') {
        return jsonResponse({ data: { id: 'ext-1', extension_number: '201', status: 'active' } }, 201);
      }
      if (url.endsWith('/call-events?tenant_id=tenant-1')) {
        return jsonResponse({ data: [{ id: 'event-1', call_id: 'call-1', event_type: 'channel_create' }] });
      }
      if (url.endsWith('/platform/tenants')) {
        return jsonResponse({
          data: [{
            id: 'tenant-1',
            name: 'Tenant 1',
            slug: 'tenant-1',
            directory_domain: 'tenant-1.example.test',
            status: 'active',
            created_at: '2026-05-31T00:00:00.000Z',
            updated_at: '2026-05-31T00:00:00.000Z',
          }],
        });
      }
      if (url.endsWith('/platform/runtime/health')) {
        return jsonResponse({
          data: {
            services: [{
              name: 'api',
              url: 'http://localhost:3000/health',
              status: 'healthy',
              detail: 'ok',
            }],
          },
        });
      }
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    };

    const client = new ManageCallApiClient({ baseUrl: 'https://api.example.test/api/v1', fetch: fetchMock });
    const auth = await client.login({ tenant_slug: 'tenant-1', email: 'owner@example.com', password: 'Secret123!' });
    const extension = await client.createExtension(
      {
        extension_number: '201',
        display_name: 'Support',
        sip_username: '201',
        sip_password: 'not-logged',
      },
      { accessToken: auth.token },
    );
    const events = await client.listCallEvents({ accessToken: auth.token, tenant_id: 'tenant-1' });
    const tenants = await client.listPlatformTenants({ accessToken: auth.token });
    const health = await client.getPlatformRuntimeHealth({ accessToken: auth.token });

    expect(extension.id).toBe('ext-1');
    expect(events[0]?.call_id).toBe('call-1');
    expect(tenants[0]?.id).toBe('tenant-1');
    expect(health.services[0]?.status).toBe('healthy');
    expect(requests).toEqual([
      {
        url: 'https://api.example.test/api/v1/auth/login',
        method: 'POST',
        body: { tenant_slug: 'tenant-1', email: 'owner@example.com', password: 'Secret123!' },
        authorization: undefined,
      },
      {
        url: 'https://api.example.test/api/v1/extensions',
        method: 'POST',
        body: {
          extension_number: '201',
          display_name: 'Support',
          sip_username: '201',
          sip_password: 'not-logged',
        },
        authorization: 'Bearer login-token',
      },
      {
        url: 'https://api.example.test/api/v1/call-events?tenant_id=tenant-1',
        method: 'GET',
        body: undefined,
        authorization: 'Bearer login-token',
      },
      {
        url: 'https://api.example.test/api/v1/platform/tenants',
        method: 'GET',
        body: undefined,
        authorization: 'Bearer login-token',
      },
      {
        url: 'https://api.example.test/api/v1/platform/runtime/health',
        method: 'GET',
        body: undefined,
        authorization: 'Bearer login-token',
      },
    ]);
  });

  it.each([
    [400, 'INVALID_ARGUMENT'],
    [401, 'UNAUTHENTICATED'],
    [403, 'PERMISSION_DENIED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RESOURCE_EXHAUSTED'],
    [500, 'INTERNAL'],
  ])('throws ManageCallApiError for %i responses', async (status, code) => {
    const fetchMock: typeof fetch = async () => jsonResponse({ error: code }, status);
    const client = new ManageCallApiClient({ baseUrl: 'https://api.example.test/api/v1', fetch: fetchMock });

    await expect(client.listExtensions({ accessToken: 'token' })).rejects.toMatchObject({
      name: 'ManageCallApiError',
      message: code,
      status,
      detail: { error: code },
    });
  });

  it('uses a stable fallback error message when the API error body has no string code', async () => {
    const fetchMock: typeof fetch = async () => jsonResponse({ details: ['failed'] }, 422);
    const client = new ManageCallApiClient({ baseUrl: 'https://api.example.test/api/v1', fetch: fetchMock });

    await expect(client.listExtensions({ accessToken: 'token' })).rejects.toEqual(
      new ManageCallApiError('API request failed: 422', 422, { details: ['failed'] }),
    );
  });

  it('covers IVR list/get/rollback, phone numbers, inbound routes, and recordings', async () => {
    const BASE = 'https://api.example.test/api/v1';
    const TOKEN = 'bearer-token';
    const FLOW_ID = '00000000-0000-0000-0000-000000000010';
    const requests: Array<{ url: string; method: string }> = [];

    const fetchMock: typeof fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      requests.push({ url, method });

      if (url.endsWith('/ivr-flows') && method === 'GET')
        return jsonResponse({ data: [{ id: FLOW_ID, name: 'Main IVR', status: 'draft' }] });
      if (url === `${BASE}/ivr-flows/${FLOW_ID}`)
        return jsonResponse({ data: { id: FLOW_ID, name: 'Main IVR', status: 'active' } });
      if (url === `${BASE}/ivr-flows/${FLOW_ID}/rollback`)
        return jsonResponse({ data: { status: 'rolled_back', flow: { id: FLOW_ID } } });
      if (url.endsWith('/phone-numbers'))
        return jsonResponse({ data: [{ id: 'pn-1', number: '+15551234567', status: 'active' }] });
      if (url.endsWith('/inbound-routes'))
        return jsonResponse({ data: [{ id: 'ir-1', did: '+15551234567', status: 'active' }] });
      if (url.includes('/recordings'))
        return jsonResponse({ data: [{ id: 'rec-1', call_id: 'call-1', status: 'available' }] });
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
    };

    const client = new ManageCallApiClient({ baseUrl: BASE, fetch: fetchMock });
    const opts = { accessToken: TOKEN };

    const flows = await client.listIvrFlows(opts);
    const flow = await client.getIvrFlow(FLOW_ID, opts);
    const rollback = await client.rollbackIvrFlow(FLOW_ID, opts);
    const numbers = await client.listPhoneNumbers(opts);
    const routes = await client.listInboundRoutes(opts);
    const recordings = await client.listRecordings(opts);
    const recordingsByCall = await client.listRecordings({ ...opts, call_id: 'call-1' });

    expect(flows).toHaveLength(1);
    expect(flows[0]!.id).toBe(FLOW_ID);
    expect(flow.name).toBe('Main IVR');
    expect(rollback.status).toBe('rolled_back');
    expect(numbers).toHaveLength(1);
    expect(routes).toHaveLength(1);
    expect(recordings).toHaveLength(1);
    expect(recordingsByCall).toHaveLength(1);

    expect(requests).toEqual([
      { url: `${BASE}/ivr-flows`,                             method: 'GET'  },
      { url: `${BASE}/ivr-flows/${FLOW_ID}`,                  method: 'GET'  },
      { url: `${BASE}/ivr-flows/${FLOW_ID}/rollback`,         method: 'POST' },
      { url: `${BASE}/phone-numbers`,                         method: 'GET'  },
      { url: `${BASE}/inbound-routes`,                        method: 'GET'  },
      { url: `${BASE}/recordings`,                            method: 'GET'  },
      { url: `${BASE}/recordings?call_id=call-1`,             method: 'GET'  },
    ]);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
