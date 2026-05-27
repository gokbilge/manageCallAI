import type { FastifyInstance } from 'fastify';
import { apiRequest } from '../../api/client.js';

type CreateFlowBody = { name: string; description?: string };
type SimulateFlowBody = { flow_id: string; digits?: string[]; caller_number?: string; now?: string };
type PublishVersionBody = { flow_id: string; version_id: string };

export async function ivrFlowWebhookController(app: FastifyInstance): Promise<void> {
  // Surface 4a — list flows (n8n HTTP Request / Trigger node → list)
  app.post('/webhooks/n8n/ivr-flows/list', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const result = await apiRequest<unknown>('GET', '/api/v1/ivr-flows', undefined, auth);
    return reply.send(result);
  });

  // Surface 4b — create flow with initial draft version
  app.post<{ Body: CreateFlowBody }>('/webhooks/n8n/ivr-flows/create', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const result = await apiRequest<unknown>('POST', '/api/v1/ivr-flows', req.body, auth);
    return reply.code(201).send(result);
  });

  // Surface 5a — validate current draft (n8n can trigger after updating graph via PATCH)
  app.post<{ Body: { flow_id: string } }>('/webhooks/n8n/ivr-flows/validate', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const { flow_id } = req.body;
    if (!flow_id) return reply.code(400).send({ error: 'flow_id is required' });
    const result = await apiRequest<unknown>('POST', `/api/v1/ivr-flows/${encodeURIComponent(flow_id)}/validate`, undefined, auth);
    return reply.send(result);
  });

  // Surface 5b — simulate current draft
  app.post<{ Body: SimulateFlowBody }>('/webhooks/n8n/ivr-flows/simulate', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const { flow_id, ...scenario } = req.body;
    if (!flow_id) return reply.code(400).send({ error: 'flow_id is required' });
    const result = await apiRequest<unknown>('POST', `/api/v1/ivr-flows/${encodeURIComponent(flow_id)}/simulate`, scenario, auth);
    return reply.send(result);
  });

  // Surface 5c — request publish of a specific version
  app.post<{ Body: PublishVersionBody }>('/webhooks/n8n/ivr-flows/publish', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const { flow_id, version_id } = req.body;
    if (!flow_id || !version_id) return reply.code(400).send({ error: 'flow_id and version_id are required' });
    const result = await apiRequest<unknown>(
      'POST',
      `/api/v1/ivr-flows/${encodeURIComponent(flow_id)}/versions/${encodeURIComponent(version_id)}/publish`,
      undefined,
      auth,
    );
    return reply.send(result);
  });
}
