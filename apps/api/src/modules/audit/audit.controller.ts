import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const service = new AuditService(new AuditRepository(db));

const AuditQuerySchema = z.object({
  action: z.string().max(100).optional(),
  resource_type: z.string().max(100).optional(),
  since: z.string().datetime().optional(),
  limit: z.string().optional(),
});

export const auditController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUDIT_LOG_VIEW),
      schema: { querystring: AuditQuerySchema },
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
};
