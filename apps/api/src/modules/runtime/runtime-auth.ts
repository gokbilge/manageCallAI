import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { sendUnauthenticated } from '../../errors/index.js';

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

  return null;
}
