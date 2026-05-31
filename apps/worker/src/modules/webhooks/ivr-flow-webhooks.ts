import type { FastifyInstance } from 'fastify';
import {
  CreateIvrFlowBodySchema,
  SimulationScenarioSchema,
  z,
} from '@managecallai/contracts';
import { apiRequest } from '../../api/client.js';

const ValidateFlowBodySchema = z.object({ flow_id: z.string().min(1) });
const PublishVersionBodySchema = z.object({
  flow_id: z.string().min(1),
  version_id: z.string().min(1),
});
const SimulateFlowBodySchema = SimulationScenarioSchema.extend({
  flow_id: z.string().min(1),
});

export async function ivrFlowWebhookController(app: FastifyInstance): Promise<void> {
  // Surface 4a — list flows
  app.post('/webhooks/n8n/ivr-flows/list', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const result = await apiRequest<unknown>('GET', '/api/v1/ivr-flows', undefined, auth);
    return reply.send(result);
  });

  // Surface 4b — create flow with initial draft version
  app.post('/webhooks/n8n/ivr-flows/create', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const parsed = CreateIvrFlowBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'INVALID_ARGUMENT',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await apiRequest<unknown>('POST', '/api/v1/ivr-flows', parsed.data, auth);
    return reply.code(201).send(result);
  });

  // Surface 5a — validate current draft
  app.post('/webhooks/n8n/ivr-flows/validate', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const parsed = ValidateFlowBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'INVALID_ARGUMENT',
        message: 'flow_id is required',
      });
    }
    const result = await apiRequest<unknown>(
      'POST',
      `/api/v1/ivr-flows/${encodeURIComponent(parsed.data.flow_id)}/validate`,
      undefined,
      auth,
    );
    return reply.send(result);
  });

  // Surface 5b — simulate current draft
  app.post('/webhooks/n8n/ivr-flows/simulate', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const parsed = SimulateFlowBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'INVALID_ARGUMENT',
        message: 'Invalid request body',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { flow_id, ...scenario } = parsed.data;
    const result = await apiRequest<unknown>(
      'POST',
      `/api/v1/ivr-flows/${encodeURIComponent(flow_id)}/simulate`,
      scenario,
      auth,
    );
    return reply.send(result);
  });

  // Surface 5c — request publish of a specific version
  app.post('/webhooks/n8n/ivr-flows/publish', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Authorization header is required' });
    const parsed = PublishVersionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'INVALID_ARGUMENT',
        message: 'flow_id and version_id are required',
      });
    }
    const result = await apiRequest<unknown>(
      'POST',
      `/api/v1/ivr-flows/${encodeURIComponent(parsed.data.flow_id)}/versions/${encodeURIComponent(parsed.data.version_id)}/publish`,
      undefined,
      auth,
    );
    return reply.send(result);
  });
}
