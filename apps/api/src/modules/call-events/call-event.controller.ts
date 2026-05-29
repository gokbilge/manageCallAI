import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { CallEventRepository } from './call-event.repository.js';
import { CallEventService } from './call-event.service.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { sendPermissionDenied } from '../../errors/index.js';
import { IngestCallEventBodySchema } from '@managecallai/contracts';

const service = new CallEventService(new CallEventRepository(db));

export const callEventController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALLS_VIEW),
      schema: {
        querystring: z.object({
          tenant_id: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const tenantId = req.query.tenant_id ?? user.tenant_id;
      if (tenantId !== user.tenant_id) {
        return sendPermissionDenied(reply, 'Forbidden');
      }
      return { data: await service.listByTenant(tenantId) };
    },
  );

  app.post(
    '/internal/ingest',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: IngestCallEventBodySchema,
      },
    },
    async (req, reply) => {
      const event = await service.ingest(req.body);
      return reply.code(201).send({ data: event });
    },
  );
};
