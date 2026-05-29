import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { IvrFlowRepository } from '../ivr-flows/ivr-flow.repository.js';
import { fireWebhooks } from '../automation/webhook-delivery.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { ApprovalRepository } from './approval.repository.js';
import {
  ApprovalAlreadyDecidedError,
  ApprovalNotFoundError,
  ApprovalPublishRecordMissingError,
  ApprovalService,
} from './approval.service.js';

const service = new ApprovalService(
  new ApprovalRepository(db),
  new IvrFlowRepository(db),
);

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof ApprovalNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof ApprovalAlreadyDecidedError || err instanceof ApprovalPublishRecordMissingError) {
    return reply.code(409).send({ error: err.message });
  }
  throw err;
}

export async function approvalController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_APPROVALS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listPending(user.tenant_id) };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/approve',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_APPROVALS_DECIDE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.approve(req.params.id, user.tenant_id, user.sub);
        fireWebhooks(user.tenant_id, 'approval.approved', { approval_request_id: req.params.id });
        fireAuditEvent({ tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role, action: 'approval.approved', resource_type: 'approval_request', resource_id: req.params.id });
        return reply.code(200).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/reject',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_APPROVALS_DECIDE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.reject(req.params.id, user.tenant_id, user.sub);
        fireWebhooks(user.tenant_id, 'approval.rejected', { approval_request_id: req.params.id });
        fireAuditEvent({ tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role, action: 'approval.rejected', resource_type: 'approval_request', resource_id: req.params.id });
        return reply.code(200).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
}

export async function policiesController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_APPROVALS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listPolicies(user.tenant_id) };
    },
  );
}
