import type { FastifyInstance } from 'fastify';
import {
  CreateExtensionBodySchema,
} from '@managecallai/contracts';
import { z } from '@managecallai/contracts';
import { apiRequest } from '../../api/client.js';

const CallEventQuerySchema = z.object({
  tenant_id: z.string().uuid().optional(),
});

export async function webhookController(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhooks/n8n/extensions/create',
    async (req, reply) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: 'Authorization header is required' });
      }

      const parsed = CreateExtensionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'INVALID_ARGUMENT',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await apiRequest<unknown>(
        'POST',
        '/api/v1/extensions',
        parsed.data,
        authorization,
      );
      return reply.code(201).send(result);
    },
  );

  app.post(
    '/webhooks/n8n/call-events/list',
    async (req, reply) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: 'Authorization header is required' });
      }

      const parsed = CallEventQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'INVALID_ARGUMENT',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const qs = parsed.data.tenant_id
        ? `?tenant_id=${encodeURIComponent(parsed.data.tenant_id)}`
        : '';

      return apiRequest<unknown>('GET', `/api/v1/call-events${qs}`, undefined, authorization);
    },
  );
}
