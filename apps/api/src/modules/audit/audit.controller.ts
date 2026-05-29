import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const service = new AuditService(new AuditRepository(db));

export async function auditController(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { action?: string; resource_type?: string; since?: string; limit?: string };
  }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUDIT_LOG_VIEW),
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string', maxLength: 100 },
            resource_type: { type: 'string', maxLength: 100 },
            since: { type: 'string', format: 'date-time' },
            limit: { type: 'string' },
          },
        },
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const { action, resource_type, since, limit } = req.query;
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const entries = await service.getAuditLog(user.tenant_id, {
        action,
        resource_type,
        since,
        limit: parsedLimit && !isNaN(parsedLimit) ? parsedLimit : undefined,
      });
      return { data: entries };
    },
  );
}
