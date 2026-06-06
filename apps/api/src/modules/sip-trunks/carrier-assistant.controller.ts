import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  CarrierAssistantSuggestionResponseSchema,
  CreateCarrierAssistantSuggestionBodySchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { authenticate } from '../auth/authenticate.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound } from '../../errors/index.js';
import { NodeStatusRepository } from '../runtime/node-status.repository.js';
import { RuntimeApplyRepository } from './runtime-apply.repository.js';
import { SipTrunkRepository } from './sip-trunk.repository.js';
import {
  CarrierAssistantService,
  CarrierAssistantTargetNotFoundError,
} from './carrier-assistant.service.js';

const service = new CarrierAssistantService(
  new SipTrunkRepository(db),
  new RuntimeApplyRepository(db),
  new NodeStatusRepository(db),
);

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof CarrierAssistantTargetNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const carrierAssistantController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate);

  app.post(
    '/assistant/draft',
    {
      schema: {
        body: CreateCarrierAssistantSuggestionBodySchema,
        response: { 200: CarrierAssistantSuggestionResponseSchema },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const suggestion = await service.suggest(user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.carrier_assistant.draft_requested',
          resource_type: 'sip_trunk_draft',
          resource_id: suggestion.target_trunk_id ?? 'new',
          metadata: {
            assistant_mode: suggestion.assistant_mode,
            matched_template: suggestion.matched_template,
            missing_field_count: suggestion.missing_fields.length,
          },
        });
        return { data: suggestion };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
