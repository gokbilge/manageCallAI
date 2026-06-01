// SLICE-43: HMAC-signed node authentication middleware
//
// FreeSWITCH nodes sign their runtime HTTP requests with HMAC-SHA256.
// The middleware verifies:
//   1. Timestamp freshness (±TIMESTAMP_TOLERANCE_S seconds)
//   2. Nonce uniqueness (replay protection, 10-minute window)
//   3. Node status (must be active)
//   4. Source IP in allowed_cidrs (if any configured)
//   5. Requested endpoint family in node capabilities
//   6. HMAC-SHA256 signature matches
//
// Falls back to shared-token auth when node identity headers are absent,
// allowing a rolling upgrade from token-only to per-node auth.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../../db/client.js';
import { sendUnauthenticated } from '../../errors/index.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { NodeRegistryRepository } from './node-registry.repository.js';
import { authenticateRuntime } from './runtime-auth.js';

const NODE_ID_HEADER = 'x-managecallai-node-id';
const TIMESTAMP_HEADER = 'x-managecallai-timestamp';
const NONCE_HEADER = 'x-managecallai-nonce';
const SIGNATURE_HEADER = 'x-managecallai-signature';

const TIMESTAMP_TOLERANCE_S = 300; // ±5 minutes

const nodeRepo = new NodeRegistryRepository(db);

// Map HTTP path prefix → required node capability family
const CAPABILITY_MAP: Array<{ prefix: string; capability: string }> = [
  { prefix: '/api/v1/freeswitch/dialplan', capability: 'dialplan' },
  { prefix: '/api/v1/freeswitch/directory', capability: 'directory' },
  { prefix: '/api/v1/freeswitch/', capability: 'dialplan' },
  { prefix: '/api/v1/runtime/ivr', capability: 'dialplan' },
  { prefix: '/api/v1/runtime/events', capability: 'event_ingest' },
  { prefix: '/api/v1/runtime/outbound', capability: 'outbound_poll' },
  { prefix: '/api/v1/runtime/', capability: 'event_ingest' },
  { prefix: '/api/v1/recordings/internal', capability: 'event_ingest' },
  { prefix: '/api/v1/recording-analysis/internal', capability: 'event_ingest' },
];

function requiredCapabilityForPath(path: string): string | null {
  for (const entry of CAPABILITY_MAP) {
    if (path.startsWith(entry.prefix)) return entry.capability;
  }
  return null;
}

// Simple IPv4 CIDR membership check (e.g. "10.0.0.0/8")
function ipInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/') as [string, string | undefined];
  const prefix = prefixStr !== undefined ? parseInt(prefixStr, 10) : 32;

  const ipNum = ipToNum(ip);
  const netNum = ipToNum(network);
  if (ipNum === null || netNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

function ipToNum(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const byte = parseInt(part, 10);
    if (Number.isNaN(byte) || byte < 0 || byte > 255) return null;
    num = (num << 8) | byte;
  }
  return num >>> 0;
}

function ipAllowed(sourceIp: string, allowedCidrs: string[]): boolean {
  if (allowedCidrs.length === 0) return true;
  return allowedCidrs.some((cidr) => ipInCidr(sourceIp, cidr));
}

function buildCanonicalString(method: string, path: string, timestamp: string, nonce: string): string {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}`;
}

function computeSignature(rawToken: string, canonical: string): string {
  return createHmac('sha256', rawToken).update(canonical).digest('hex');
}

export async function authenticateRuntimeNode(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const nodeId = req.headers[NODE_ID_HEADER];
  const timestamp = req.headers[TIMESTAMP_HEADER];
  const nonce = req.headers[NONCE_HEADER];
  const signature = req.headers[SIGNATURE_HEADER];

  // If node identity headers are absent, fall back to shared-token auth.
  if (!nodeId || !timestamp || !nonce || !signature) {
    return authenticateRuntime(req, reply);
  }

  if (
    typeof nodeId !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof nonce !== 'string' ||
    typeof signature !== 'string'
  ) {
    emitAuthFailure(req, 'invalid_headers', null);
    return sendUnauthenticated(reply);
  }

  // 1. Timestamp freshness
  const tsSeconds = parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Number.isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > TIMESTAMP_TOLERANCE_S) {
    emitAuthFailure(req, 'stale_timestamp', nodeId);
    return sendUnauthenticated(reply);
  }

  // 2. Load node (status check implicit: getDecryptedToken requires status = active)
  const rawToken = await nodeRepo.getDecryptedToken(nodeId);
  if (!rawToken) {
    emitAuthFailure(req, 'node_not_found_or_disabled', nodeId);
    return sendUnauthenticated(reply);
  }

  // 3. Source IP check
  const node = await nodeRepo.findById(nodeId);
  if (!node) {
    emitAuthFailure(req, 'node_not_found_or_disabled', nodeId);
    return sendUnauthenticated(reply);
  }

  const sourceIp = req.ip;
  if (!ipAllowed(sourceIp, node.allowed_cidrs)) {
    emitAuthFailure(req, 'source_ip_denied', nodeId);
    return sendUnauthenticated(reply);
  }

  // 4. Capability check
  const requiredCapability = requiredCapabilityForPath(req.url);
  if (requiredCapability && !node.capabilities.includes(requiredCapability)) {
    emitAuthFailure(req, 'capability_denied', nodeId);
    return sendUnauthenticated(reply);
  }

  // 5. Nonce replay check
  const nonceConsumed = await nodeRepo.checkAndConsumeNonce(nodeId, nonce);
  if (!nonceConsumed) {
    emitAuthFailure(req, 'replayed_nonce', nodeId);
    return sendUnauthenticated(reply);
  }

  // 6. HMAC signature
  const canonical = buildCanonicalString(req.method, req.url.split('?')[0]!, timestamp, nonce);
  const expected = computeSignature(rawToken, canonical);

  let sigMatch = false;
  try {
    sigMatch = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // Lengths differ — definitely not equal
  }

  if (!sigMatch) {
    emitAuthFailure(req, 'invalid_signature', nodeId);
    return sendUnauthenticated(reply);
  }

  // Authenticated — populate req.runtime and req.user for downstream handlers
  req.runtime = { tenant_id: undefined, auth_type: 'bearer', node_id: nodeId };
  req.user = {
    sub: `node:${nodeId}`,
    tenant_id: (req.headers['x-tenant-id'] as string | undefined)?.trim() ?? '',
    email: 'runtime@managecallai.internal',
    role: 'tenant_admin',
  };
}

function emitAuthFailure(req: FastifyRequest, reason: string, nodeId: string | null): void {
  fireAuditEvent({
    tenant_id: '',
    actor_id: null,
    action: 'runtime_node.auth_failed',
    resource_type: 'freeswitch_node',
    resource_id: nodeId ?? undefined,
    metadata: { reason, source_ip: req.ip, path: req.url },
  });
}

// Exported for tests
export { buildCanonicalString, computeSignature, ipAllowed };
