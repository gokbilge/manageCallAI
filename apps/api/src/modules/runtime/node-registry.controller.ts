import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import { sendNotFound } from '../../errors/index.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { authenticatePlatform } from '../platform/authenticate-platform.js';
import { NodeRegistryRepository } from './node-registry.repository.js';
import { NodeNotFoundError, NodeRegistryService } from './node-registry.service.js';

const repo = new NodeRegistryRepository(db);
const service = new NodeRegistryService(repo);

const NODE_CAPABILITIES_ENUM = ['dialplan', 'directory', 'event_ingest', 'outbound_poll'] as const;

export const nodeRegistryController: FastifyPluginAsyncZod = async (app) => {
  // Platform admin only — same protection as platform.controller.ts.
  // Rate limited globally via the onRequest hook in registerRateLimitHook (app.ts).
  app.addHook('preHandler', authenticatePlatform);

  app.get('/nodes', async () => {
    return { data: await service.list() };
  });

  app.get(
    '/nodes/:id',
    { schema: { params: UuidParamsSchema } },
    async (req, reply) => {
      try {
        return { data: await service.getById(req.params.id) };
      } catch (err) {
        if (err instanceof NodeNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/nodes',
    {
      schema: {
        body: z.object({
          display_name: z.string().min(1).max(255),
          allowed_cidrs: z.array(z.string().max(50)).max(50).optional(),
          capabilities: z.array(z.enum(NODE_CAPABILITIES_ENUM)).optional(),
          rate_limit_policy: z.record(z.unknown()).optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const result = await service.create(req.body);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'freeswitch_node.created',
        resource_type: 'freeswitch_node',
        resource_id: result.node.id,
      });
      // raw_token is returned once on creation; operator must store it securely
      return reply.code(201).send({ data: result.node, raw_token: result.raw_token });
    },
  );

  app.patch(
    '/nodes/:id',
    {
      schema: {
        params: UuidParamsSchema,
        body: z.object({
          display_name: z.string().min(1).max(255).optional(),
          status: z.enum(['active', 'disabled', 'decommissioned']).optional(),
          allowed_cidrs: z.array(z.string().max(50)).max(50).optional(),
          capabilities: z.array(z.enum(NODE_CAPABILITIES_ENUM)).optional(),
          rate_limit_policy: z.record(z.unknown()).optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        const node = await service.update(req.params.id, req.body);
        return { data: node };
      } catch (err) {
        if (err instanceof NodeNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/nodes/:id/rotate-token',
    { schema: { params: UuidParamsSchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.rotateToken(req.params.id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'freeswitch_node.token_rotated',
          resource_type: 'freeswitch_node',
          resource_id: req.params.id,
        });
        return { data: result.node, raw_token: result.raw_token };
      } catch (err) {
        if (err instanceof NodeNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );
};
