import type { FastifyInstance } from 'fastify';
import { apiRequest } from '../../api/client.js';

type ExtensionCreateBody = {
  tenant_id: string;
  extension_number: string;
  display_name: string;
  default_destination_type?: string;
  default_destination_id?: string;
};

type CallEventListBody = {
  tenant_id?: string;
};

export async function webhookController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ExtensionCreateBody }>(
    '/webhooks/n8n/extensions/create',
    async (req, reply) => {
      const result = await apiRequest<unknown>('POST', '/api/v1/extensions', req.body);
      return reply.code(201).send(result);
    },
  );

  app.post<{ Body: CallEventListBody }>(
    '/webhooks/n8n/call-events/list',
    async (req) => {
      const tenantId = req.body.tenant_id
        ? `?tenant_id=${encodeURIComponent(req.body.tenant_id)}`
        : '';

      return apiRequest<unknown>('GET', `/api/v1/call-events${tenantId}`);
    },
  );
}
