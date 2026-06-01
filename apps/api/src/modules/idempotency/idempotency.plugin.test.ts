import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({ db: {} }));

const mockFind = vi.fn();
const mockStore = vi.fn();

vi.mock('./idempotency.repository.js', () => ({
  IdempotencyRepository: class {
    find = mockFind;
    store = mockStore;
  },
}));

const { idempotencyPlugin } = await import('./idempotency.plugin.js');

function makeApp() {
  const pre: Array<(req: unknown, reply: unknown) => Promise<void>> = [];
  const onSend: Array<(req: unknown, reply: unknown, p: unknown) => Promise<unknown>> = [];
  return {
    addHook: vi.fn((ev: string, fn: never) => {
      if (ev === 'preHandler') pre.push(fn);
      if (ev === 'onSend') onSend.push(fn);
    }),
    _pre: (req: unknown, rep: unknown) => Promise.all(pre.map(fn => fn(req, rep))),
    _send: (req: unknown, rep: unknown, p: unknown) =>
      onSend.reduce((a: Promise<unknown>, fn) => a.then(x => fn(req, rep, x)), Promise.resolve(p)),
  };
}

function req(overrides: { method?: string; headers?: Record<string, string>; user?: { tenant_id: string } } = {}) {
  return { method: overrides.method ?? 'POST', headers: overrides.headers ?? {}, user: overrides.user ?? { tenant_id: 'tenant-1' } };
}

function rep(statusCode = 201) {
  return { code: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), hasHeader: vi.fn().mockReturnValue(false), statusCode };
}

describe('idempotencyPlugin', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFind.mockResolvedValue(null); mockStore.mockResolvedValue(undefined); });

  it('registers preHandler and onSend hooks', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    expect(app.addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));
    expect(app.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
  });

  it('skips GET requests', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    await app._pre(req({ method: 'GET', headers: { 'idempotency-key': 'k' } }), rep());
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('skips when no idempotency-key header', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    await app._pre(req(), rep()); expect(mockFind).not.toHaveBeenCalled();
  });

  it('rejects key longer than 255 chars', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    const r = rep(); await app._pre(req({ headers: { 'idempotency-key': 'x'.repeat(256) } }), r);
    expect(r.code).toHaveBeenCalledWith(400);
  });

  it('replays cached response', async () => {
    const cached = { status_code: 201, response_body: { data: { id: 'cached' } } };
    mockFind.mockResolvedValue(cached);
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    const r = rep(); await app._pre(req({ headers: { 'idempotency-key': 'k' } }), r);
    expect(r.header).toHaveBeenCalledWith('idempotency-replayed', 'true');
    expect(r.code).toHaveBeenCalledWith(201);
  });

  it('stores successful response in onSend', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    const payload = JSON.stringify({ data: { id: 'n' } });
    await app._send(req({ headers: { 'idempotency-key': 'k' } }), rep(201), payload);
    expect(mockStore).toHaveBeenCalledWith('tenant-1', 'k', 201, expect.any(Object));
  });

  it('skips storing error responses', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    await app._send(req({ headers: { 'idempotency-key': 'k' } }), rep(400), JSON.stringify({ error: 'bad' }));
    expect(mockStore).not.toHaveBeenCalled();
  });

  it('skips storing non-JSON payload', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    await app._send(req({ headers: { 'idempotency-key': 'k' } }), rep(200), 'not-json');
    expect(mockStore).not.toHaveBeenCalled();
  });

  it('skips storing replayed responses', async () => {
    const app = makeApp(); await idempotencyPlugin(app as never, {});
    const r = { ...rep(201), hasHeader: vi.fn().mockReturnValue(true) };
    await app._send(req({ headers: { 'idempotency-key': 'k' } }), r, JSON.stringify({ data: {} }));
    expect(mockStore).not.toHaveBeenCalled();
  });
});
