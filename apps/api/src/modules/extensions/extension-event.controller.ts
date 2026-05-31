import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { sendInvalidArgument } from '../../errors/index.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { TenantScopeError } from '../domain-assertions.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ExtensionEventRepository } from './extension-event.repository.js';
import { ExtensionEventService } from './extension-event.service.js';

const service = new ExtensionEventService(new ExtensionEventRepository(db));

const IngestExtensionEventBodySchema = z.object({
  tenant_id: z.string().uuid(),
  extension_number: z.string().min(1),
  event_type: z.enum(['registered', 'expired', 'unregistered', 'auth_failed']),
  contact_domain: z.string().optional(),
  user_agent: z.string().optional(),
  source_ip: z.string().optional(),
  freeswitch_event_id: z.string().optional(),
});

function handleExtensionEventError(err: unknown, reply: FastifyReply): void {
  if (err instanceof TenantScopeError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const extensionEventController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/extension-events',
    {
      preHandler: authenticateRuntime,
      schema: { body: IngestExtensionEventBodySchema },
    },
    async (req, reply) => {
      try {
        const result = await service.ingest(req.body, req.runtime?.tenant_id);
        if (result.replayed) {
          return reply.code(200).send({ data: null, replayed: true });
        }
        return reply.code(201).send({ data: result.event });
      } catch (err) {
        return handleExtensionEventError(err, reply);
      }
    },
  );

  app.get(
    '/:extensionNumber/events',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
      schema: {
        params: z.object({ extensionNumber: z.string() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return {
        data: await service.listByExtension(user.tenant_id, req.params.extensionNumber, req.query.limit),
      };
    },
  );
};
