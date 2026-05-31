import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { sendUnauthenticated } from '../../errors/index.js';

const RUNTIME_TOKEN_QUERY_KEY = 'runtime_token';
const RUNTIME_TOKEN_HEADER_KEY = 'x-managecallai-runtime-token';
const RUNTIME_TENANT_HEADER_KEY = 'x-tenant-id';

export async function authenticateRuntime(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const credential = extractRuntimeCredential(req);

  if (credential.token !== config.runtimeApiToken) {
    return sendUnauthenticated(reply);
  }

  const tenantId = extractTenantId(req);
  req.runtime = {
    tenant_id: tenantId ?? undefined,
    auth_type: credential.authType,
  };
  req.user = {
    sub: 'runtime',
    tenant_id: tenantId ?? '',
    email: 'runtime@managecallai.internal',
    role: 'tenant_admin',
  };
}

function extractRuntimeCredential(req: FastifyRequest): { token: string | null; authType: 'bearer' | 'basic' | 'header' | 'fallback' } {
  const authHeader = req.headers.authorization?.trim();
  if (authHeader?.startsWith('Bearer ')) {
    return { token: authHeader.slice('Bearer '.length).trim(), authType: 'bearer' };
  }

  if (authHeader?.startsWith('Basic ')) {
    return { token: extractBasicPassword(authHeader), authType: 'basic' };
  }

  const headerToken = req.headers[RUNTIME_TOKEN_HEADER_KEY];
  if (typeof headerToken === 'string' && headerToken.trim() !== '') {
    return { token: headerToken.trim(), authType: 'header' };
  }

  if (!config.allowRuntimeTokenFallback) return { token: null, authType: 'fallback' };

  const query = req.query as Record<string, unknown> | undefined;
  const queryToken = query?.[RUNTIME_TOKEN_QUERY_KEY];
  if (typeof queryToken === 'string' && queryToken.trim() !== '') {
    return { token: queryToken.trim(), authType: 'fallback' };
  }

  const body = req.body as Record<string, unknown> | undefined;
  const bodyToken = body?.[RUNTIME_TOKEN_QUERY_KEY];
  if (typeof bodyToken === 'string' && bodyToken.trim() !== '') {
    return { token: bodyToken.trim(), authType: 'fallback' };
  }

  return { token: null, authType: 'fallback' };
}

function extractBasicPassword(authHeader: string): string | null {
  const encoded = authHeader.slice('Basic '.length).trim();
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;
    return decoded.slice(separator + 1).trim();
  } catch {
    return null;
  }
}

function extractTenantId(req: FastifyRequest): string | null {
  const header = req.headers[RUNTIME_TENANT_HEADER_KEY];
  if (typeof header === 'string' && header.trim() !== '') {
    return header.trim();
  }

  return null;
}
