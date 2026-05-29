import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ProviderWorkRepository } from './provider-work.repository.js';
import { ProviderWorkRequestNotFoundError, ProviderWorkService } from './provider-work.service.js';
import type {
  ClaimWorkRequestInput,
  CompleteIvrAiTurnInput,
  CompletePromptGenerationInput,
  CreateIvrAiTurnInput,
  CreatePromptGenerationInput,
} from './provider-work.types.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';

const service = new ProviderWorkService(new ProviderWorkRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof ProviderWorkRequestNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

const providerEnum = ['auto', 'openai', 'elevenlabs', 'whisper', 'external', 'custom'];

export async function promptGenerationController(app: FastifyInstance): Promise<void> {
  app.get(
    '/requests',
    { preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listPromptGenerations(user.tenant_id) };
    },
  );

  app.post<{ Body: CreatePromptGenerationInput }>(
    '/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['requested_outputs', 'input_text'],
          additionalProperties: false,
          properties: {
            prompt_asset_id: { type: 'string' },
            requested_outputs: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
            input_text: { type: 'string', minLength: 1, maxLength: 20000 },
            language_hint: { type: 'string', maxLength: 32 },
            voice_hint: { type: 'string', maxLength: 255 },
            provider_hint: { type: 'string', enum: providerEnum },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const request = await service.createPromptGeneration(user.tenant_id, req.body);
      return reply.code(201).send({ data: request });
    },
  );

  app.get<{ Params: { requestId: string } }>(
    '/requests/:requestId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW),
      schema: { params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getPromptGeneration(req.params.requestId, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post<{ Params: { requestId: string }; Body: ClaimWorkRequestInput }>(
    '/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
        body: { type: 'object', additionalProperties: false, properties: { processor_id: { type: 'string', maxLength: 255 } } },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimPromptGeneration(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post<{ Params: { requestId: string }; Body: CompletePromptGenerationInput }>(
    '/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['completed', 'failed'] },
            generated_prompt_asset_id: { type: 'string' },
            media_reference: { type: 'string', maxLength: 2048 },
            error_message: { type: 'string', maxLength: 500 },
            provider_metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completePromptGeneration(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
}

export async function ivrAiController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateIvrAiTurnInput }>(
    '/runtime/ivr-ai/turns',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: {
          type: 'object',
          required: ['call_id', 'node_id', 'input_mode', 'requested_outputs'],
          additionalProperties: false,
          properties: {
            tenant_id: { type: 'string', minLength: 1 },
            runtime_session_id: { type: 'string' },
            call_id: { type: 'string', minLength: 1, maxLength: 255 },
            flow_id: { type: 'string' },
            node_id: { type: 'string', minLength: 1, maxLength: 255 },
            input_mode: { type: 'string', enum: ['text', 'transcript', 'dtmf', 'metadata'] },
            input_text: { type: 'string', maxLength: 20000 },
            requested_outputs: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
            provider_hint: { type: 'string', enum: providerEnum },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const tenantId = req.body.tenant_id ?? '';
      if (!tenantId) return sendInvalidArgument(reply, 'tenant_id is required for runtime IVR AI turns');
      const request = await service.createIvrAiTurn(tenantId, req.body);
      return reply.code(201).send({ data: request });
    },
  );

  app.get<{ Params: { requestId: string } }>(
    '/runtime/ivr-ai/turns/:requestId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getIvrAiTurn(req.params.requestId, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post<{ Params: { requestId: string }; Body: ClaimWorkRequestInput }>(
    '/ivr-ai/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
        body: { type: 'object', additionalProperties: false, properties: { processor_id: { type: 'string', maxLength: 255 } } },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimIvrAiTurn(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post<{ Params: { requestId: string }; Body: CompleteIvrAiTurnInput }>(
    '/ivr-ai/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['completed', 'failed'] },
            answer_text: { type: 'string', maxLength: 20000 },
            next_action: { type: 'object', additionalProperties: true },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            error_message: { type: 'string', maxLength: 500 },
            provider_metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completeIvrAiTurn(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
}
