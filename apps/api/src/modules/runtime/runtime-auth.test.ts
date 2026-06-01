// SLICE-46: Runtime secret hardening tests
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mutable config so tests can vary secondary token
const mockConfig = {
  runtimeApiToken: 'primary-token',
  runtimeApiTokenSecondary: null as string | null,
  allowRuntimeTokenFallback: false,
};

vi.mock('../../config/env.js', () => ({ config: mockConfig }));
vi.mock('../audit/fire-audit.js', () => ({ fireAuditEvent: vi.fn() }));

const { authenticateRuntime } = await import('./runtime-auth.js');
const { fireAuditEvent } = await import('../audit/fire-audit.js');

function makeReq(overrides: Partial<{
  headers: Record<string, string | undefined>;
  query: Record<string, string>;
  body: Record<string, string>;
  url: string;
  ip: string;
}> = {}) {
  return {
    headers: overrides.headers ?? {},
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    url: overrides.url ?? '/api/v1/runtime/events',
    ip: overrides.ip ?? '127.0.0.1',
    runtime: undefined as unknown,
    user: undefined as unknown,
  };
}

function makeReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    request: { id: 'test-req-id' },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  mockConfig.runtimeApiToken = 'primary-token';
  mockConfig.runtimeApiTokenSecondary = null;
  mockConfig.allowRuntimeTokenFallback = false;
});

describe('authenticateRuntime', () => {
  it('authenticates with valid Bearer token', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer primary-token' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).not.toHaveBeenCalled();
    expect((req as { user?: { sub: string } }).user?.sub).toBe('runtime');
  });

  it('authenticates with valid header token', async () => {
    const req = makeReq({ headers: { 'x-managecallai-runtime-token': 'primary-token' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('authenticates with Basic auth (password field)', async () => {
    const encoded = Buffer.from('ignored:primary-token').toString('base64');
    const req = makeReq({ headers: { authorization: `Basic ${encoded}` } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('rejects wrong token and emits audit event', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer wrong-token' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(vi.mocked(fireAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'runtime.auth_failed' }),
    );
  });

  it('emits audit event with path and source_ip on failure', async () => {
    const req = makeReq({
      headers: { authorization: 'Bearer bad' },
      url: '/api/v1/freeswitch/dialplan',
      ip: '10.0.0.1',
    });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(vi.mocked(fireAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'runtime.auth_failed',
        metadata: expect.objectContaining({
          path: '/api/v1/freeswitch/dialplan',
          source_ip: '10.0.0.1',
        }),
      }),
    );
  });

  it('rejects missing token and emits audit event', async () => {
    const req = makeReq();
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(vi.mocked(fireAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'runtime.auth_failed' }),
    );
  });

  it('does not accept query-param token when allowRuntimeTokenFallback=false', async () => {
    const req = makeReq({ query: { runtime_token: 'primary-token' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    // allowRuntimeTokenFallback is false → query param ignored → auth fails
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('accepts secondary token during rotation window', async () => {
    mockConfig.runtimeApiTokenSecondary = 'secondary-token';
    const req = makeReq({ headers: { authorization: 'Bearer secondary-token' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('does not accept secondary token when it is null', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer some-other-token' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('populates tenant_id from x-tenant-id header when present', async () => {
    const req = makeReq({
      headers: {
        authorization: 'Bearer primary-token',
        'x-tenant-id': 'tenant-abc',
      },
    });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);
    expect((req as { runtime?: { tenant_id?: string } }).runtime?.tenant_id).toBe('tenant-abc');
  });
});

// ── Support bundle redaction (SLICE-46) ───────────────────────────────────────

describe('runtime token redaction', () => {
  it('runtime token value is not present in audit failure event metadata', async () => {
    mockConfig.runtimeApiToken = 'different-primary';
    const req = makeReq({ headers: { authorization: 'Bearer secret-token-value-xyz' } });
    const reply = makeReply();
    await authenticateRuntime(req as never, reply as never);

    const callArg = vi.mocked(fireAuditEvent).mock.calls[0]?.[0];
    const serialized = JSON.stringify(callArg ?? {});
    expect(serialized).not.toContain('secret-token-value-xyz');
    expect(serialized).not.toContain('Bearer');
  });
});
