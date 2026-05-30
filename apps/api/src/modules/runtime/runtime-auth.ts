import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { sendUnauthenticated } from '../../errors/index.js';

const RUNTIME_TOKEN_QUERY_KEY = 'runtime_token';
const RUNTIME_TOKEN_HEADER_KEY = 'x-managecallai-runtime-token';

export async function authenticateRuntime(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractRuntimeToken(req);

  if (token !== config.runtimeApiToken) {
    return sendUnauthenticated(reply);
  }
}

function extractRuntimeToken(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization?.trim();
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const headerToken = req.headers[RUNTIME_TOKEN_HEADER_KEY];
  if (typeof headerToken === 'string' && headerToken.trim() !== '') {
    return headerToken.trim();
  }

  if (!config.allowRuntimeTokenFallback) return null;

  const query = req.query as Record<string, unknown> | undefined;
  const queryToken = query?.[RUNTIME_TOKEN_QUERY_KEY];
  if (typeof queryToken === 'string' && queryToken.trim() !== '') {
    return queryToken.trim();
  }

  const body = req.body as Record<string, unknown> | undefined;
  const bodyToken = body?.[RUNTIME_TOKEN_QUERY_KEY];
  if (typeof bodyToken === 'string' && bodyToken.trim() !== '') {
    return bodyToken.trim();
  }

  return null;
}
