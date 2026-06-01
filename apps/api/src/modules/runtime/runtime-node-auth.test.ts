import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildCanonicalString, computeSignature, ipAllowed } from './runtime-node-auth.js';

// ── Unit helpers ──────────────────────────────────────────────────────────────

describe('buildCanonicalString', () => {
  it('joins method, path, timestamp, nonce with newlines', () => {
    const s = buildCanonicalString('POST', '/api/v1/freeswitch/dialplan', '1717200000', 'abc123');
    expect(s).toBe('POST\n/api/v1/freeswitch/dialplan\n1717200000\nabc123');
  });

  it('uppercases the method', () => {
    const s = buildCanonicalString('get', '/health', '1', 'n');
    expect(s.slice(0, 4)).toBe('GET\n');
  });
});

describe('computeSignature', () => {
  it('produces HMAC-SHA256 hex of the canonical string', () => {
    const token = 'testsecret';
    const canonical = 'POST\n/path\n12345\nnonce';
    const expected = createHmac('sha256', token).update(canonical).digest('hex');
    expect(computeSignature(token, canonical)).toBe(expected);
  });

  it('differs for different tokens', () => {
    const canonical = 'POST\n/path\n1\nn';
    expect(computeSignature('token-a', canonical)).not.toBe(computeSignature('token-b', canonical));
  });

  it('differs for different canonicals', () => {
    const token = 'same-token';
    expect(computeSignature(token, 'a')).not.toBe(computeSignature(token, 'b'));
  });
});

describe('ipAllowed', () => {
  it('allows any IP when the allowed_cidrs list is empty', () => {
    expect(ipAllowed('10.0.0.1', [])).toBe(true);
    expect(ipAllowed('1.2.3.4', [])).toBe(true);
  });

  it('allows IP inside a /24 CIDR', () => {
    expect(ipAllowed('192.168.1.100', ['192.168.1.0/24'])).toBe(true);
  });

  it('rejects IP outside a /24 CIDR', () => {
    expect(ipAllowed('192.168.2.1', ['192.168.1.0/24'])).toBe(false);
  });

  it('allows IP matching a /16 CIDR', () => {
    expect(ipAllowed('10.20.30.40', ['10.20.0.0/16'])).toBe(true);
  });

  it('rejects IP outside a /16 CIDR', () => {
    expect(ipAllowed('10.21.0.1', ['10.20.0.0/16'])).toBe(false);
  });

  it('allows /32 exact match', () => {
    expect(ipAllowed('172.16.0.5', ['172.16.0.5/32'])).toBe(true);
    expect(ipAllowed('172.16.0.6', ['172.16.0.5/32'])).toBe(false);
  });

  it('allows if any CIDR in the list matches', () => {
    expect(ipAllowed('10.0.0.1', ['192.168.0.0/16', '10.0.0.0/8'])).toBe(true);
  });

  it('handles /0 (match all) correctly', () => {
    expect(ipAllowed('1.2.3.4', ['0.0.0.0/0'])).toBe(true);
  });

  it('rejects non-IPv4 gracefully without throwing', () => {
    expect(ipAllowed('::1', ['192.168.0.0/16'])).toBe(false);
  });
});

// ── Integration-style middleware tests ───────────────────────────────────────
// We mock the repository and test the middleware behaviour through request stubs.

vi.mock('../../db/client.js', () => ({ db: {} }));
vi.mock('../audit/fire-audit.js', () => ({ fireAuditEvent: vi.fn() }));

// We import after mocking db so module initialization doesn't need a real DB.
const { authenticateRuntimeNode } = await import('./runtime-node-auth.js');
const { NodeRegistryRepository } = await import('./node-registry.repository.js');

const RAW_TOKEN = 'deadbeef'.repeat(8); // 64-char hex token
const NODE_ID = '00000000-0000-0000-0000-000000000001';
const TIMESTAMP_NOW = () => Math.floor(Date.now() / 1000).toString();

function makeSignature(token: string, method: string, path: string, ts: string, nonce: string): string {
  const canonical = buildCanonicalString(method, path, ts, nonce);
  return computeSignature(token, canonical);
}

function makeReq(overrides: Partial<{
  headers: Record<string, string>;
  method: string;
  url: string;
  ip: string;
}> = {}) {
  return {
    method: overrides.method ?? 'POST',
    url: overrides.url ?? '/api/v1/freeswitch/dialplan',
    ip: overrides.ip ?? '10.0.0.1',
    headers: overrides.headers ?? {},
    runtime: undefined as unknown,
    user: undefined as unknown,
  };
}

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    request: { id: 'test-req-id' },
  };
  return reply;
}

function makeNodeRow(overrides: Partial<{
  status: string;
  allowed_cidrs: string[];
  capabilities: string[];
}> = {}) {
  return {
    id: NODE_ID,
    display_name: 'test-node',
    status: overrides.status ?? 'active',
    allowed_cidrs: overrides.allowed_cidrs ?? [],
    capabilities: overrides.capabilities ?? ['dialplan', 'directory', 'event_ingest', 'outbound_poll'],
    rate_limit_policy: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('authenticateRuntimeNode', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getDecryptedTokenSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let findByIdSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkNonceSpy: any;

  beforeEach(() => {
    getDecryptedTokenSpy = vi.spyOn(NodeRegistryRepository.prototype, 'getDecryptedToken');
    findByIdSpy = vi.spyOn(NodeRegistryRepository.prototype, 'findById');
    checkNonceSpy = vi.spyOn(NodeRegistryRepository.prototype, 'checkAndConsumeNonce');
  });

  afterEach(() => vi.restoreAllMocks());

  it('passes valid node-signed request', async () => {
    const ts = TIMESTAMP_NOW();
    const nonce = 'unique-nonce-1';
    const sig = makeSignature(RAW_TOKEN, 'POST', '/api/v1/freeswitch/dialplan', ts, nonce);

    getDecryptedTokenSpy.mockResolvedValue(RAW_TOKEN);
    findByIdSpy.mockResolvedValue(makeNodeRow());
    checkNonceSpy.mockResolvedValue(true);

    const req = makeReq({
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': ts,
        'x-managecallai-nonce': nonce,
        'x-managecallai-signature': sig,
      },
    });
    const reply = makeReply();

    await authenticateRuntimeNode(req as never, reply as never);

    expect(reply.code).not.toHaveBeenCalled();
    expect((req as { runtime?: unknown }).runtime).toMatchObject({ node_id: NODE_ID });
  });

  it('rejects invalid signature', async () => {
    const ts = TIMESTAMP_NOW();
    getDecryptedTokenSpy.mockResolvedValue(RAW_TOKEN);
    findByIdSpy.mockResolvedValue(makeNodeRow());
    checkNonceSpy.mockResolvedValue(true);

    const req = makeReq({
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': ts,
        'x-managecallai-nonce': 'nonce',
        'x-managecallai-signature': 'badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb',
      },
    });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('rejects stale timestamp', async () => {
    const staleTs = (Math.floor(Date.now() / 1000) - 400).toString(); // > 5 min ago
    const req = makeReq({
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': staleTs,
        'x-managecallai-nonce': 'n',
        'x-managecallai-signature': 'x'.repeat(64),
      },
    });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(getDecryptedTokenSpy).not.toHaveBeenCalled();
  });

  it('rejects replayed nonce', async () => {
    const ts = TIMESTAMP_NOW();
    const nonce = 'already-used-nonce';
    const sig = makeSignature(RAW_TOKEN, 'POST', '/api/v1/freeswitch/dialplan', ts, nonce);

    getDecryptedTokenSpy.mockResolvedValue(RAW_TOKEN);
    findByIdSpy.mockResolvedValue(makeNodeRow());
    checkNonceSpy.mockResolvedValue(false); // already seen

    const req = makeReq({
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': ts,
        'x-managecallai-nonce': nonce,
        'x-managecallai-signature': sig,
      },
    });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('rejects disabled node (getDecryptedToken returns null for non-active)', async () => {
    const ts = TIMESTAMP_NOW();
    getDecryptedTokenSpy.mockResolvedValue(null); // disabled node returns null

    const req = makeReq({
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': ts,
        'x-managecallai-nonce': 'n',
        'x-managecallai-signature': 'x'.repeat(64),
      },
    });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('rejects request from IP outside allowed_cidrs', async () => {
    const ts = TIMESTAMP_NOW();
    const nonce = 'nonce-cidr';
    const sig = makeSignature(RAW_TOKEN, 'POST', '/api/v1/freeswitch/dialplan', ts, nonce);

    getDecryptedTokenSpy.mockResolvedValue(RAW_TOKEN);
    findByIdSpy.mockResolvedValue(makeNodeRow({ allowed_cidrs: ['192.168.1.0/24'] }));

    const req = makeReq({
      ip: '10.0.0.1', // outside 192.168.1.0/24
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': ts,
        'x-managecallai-nonce': nonce,
        'x-managecallai-signature': sig,
      },
    });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('rejects capability mismatch (node not allowed to call this endpoint family)', async () => {
    const ts = TIMESTAMP_NOW();
    const nonce = 'nonce-cap';
    const sig = makeSignature(RAW_TOKEN, 'POST', '/api/v1/freeswitch/dialplan', ts, nonce);

    getDecryptedTokenSpy.mockResolvedValue(RAW_TOKEN);
    // Node only has event_ingest capability, not dialplan
    findByIdSpy.mockResolvedValue(makeNodeRow({ capabilities: ['event_ingest'] }));
    checkNonceSpy.mockResolvedValue(true);

    const req = makeReq({
      url: '/api/v1/freeswitch/dialplan',
      headers: {
        'x-managecallai-node-id': NODE_ID,
        'x-managecallai-timestamp': ts,
        'x-managecallai-nonce': nonce,
        'x-managecallai-signature': sig,
      },
    });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('falls back to shared-token auth when node headers are absent', async () => {
    // No node identity headers → should delegate to authenticateRuntime
    // authenticateRuntime will 401 because RUNTIME_API_TOKEN won't match
    const req = makeReq({ headers: { authorization: 'Bearer wrong-token' } });
    const reply = makeReply();
    await authenticateRuntimeNode(req as never, reply as never);
    // Falls through to shared-token auth, which rejects the bad token
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(getDecryptedTokenSpy).not.toHaveBeenCalled();
  });
});
