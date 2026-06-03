import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { authenticate } from '../auth/authenticate.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { sendNotFound } from '../../errors/index.js';
import { RuntimeApplyRepository } from './runtime-apply.repository.js';
import { RuntimeApplyNotFoundError, RuntimeApplyService } from './runtime-apply.service.js';

const applyRepo = new RuntimeApplyRepository(db);
const applyService = new RuntimeApplyService(applyRepo);

const UuidParam = z.object({ id: z.string().uuid() });

// What the Go agent POSTs after executing the ESL command.
const ApplyResultBodySchema = z.object({
  status: z.enum(['applied', 'failed']),
  error_message: z.string().max(1000).nullable().optional(),
});

function handleNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof RuntimeApplyNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  throw err;
}

export const runtimeApplyController: FastifyPluginAsyncZod = async (app) => {
  // ── Tenant-facing: list apply requests for a trunk ─────────────────────────
  app.get(
    '/sip-trunks/:id/apply-requests',
    { preHandler: authenticate, schema: { params: UuidParam } },
    async (req) => {
      const user = req.user as AuthClaims;
      const requests = await applyService.listByTrunk(user.tenant_id, req.params.id);
      return { data: requests };
    },
  );

  // ── Tenant-facing: get a single apply request ──────────────────────────────
  app.get(
    '/sip-trunks/:id/apply-requests/:rid',
    {
      preHandler: authenticate,
      schema: { params: z.object({ id: z.string().uuid(), rid: z.string().uuid() }) },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const req_ = await applyService.getById(req.params.rid, user.tenant_id);
        return { data: req_ };
      } catch (err) {
        return handleNotFound(err, reply);
      }
    },
  );

  // ── Runtime: Go agent polls for pending apply requests for its node ────────
  // Node identity is inferred from the runtime token + X-Tenant-ID header.
  // We use the node's registered ID from the node registry.
  app.get(
    '/runtime/gateway-apply/pending',
    {
      preHandler: authenticateRuntime,
      schema: {
        querystring: z.object({ node_id: z.string().uuid() }),
      },
    },
    async (req) => {
      const pending = await applyService.listPendingForNode(req.query.node_id);
      return { data: pending };
    },
  );

  // ── Runtime: Go agent claims a pending apply request ──────────────────────
  app.post(
    '/runtime/gateway-apply/:id/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: UuidParam,
        body: z.object({ node_id: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      try {
        const claimed = await applyService.claimForNode(req.params.id, req.body.node_id);
        return { data: claimed };
      } catch (err) {
        return handleNotFound(err, reply);
      }
    },
  );

  // ── Runtime: Go agent posts the result after executing the ESL command ─────
  app.post(
    '/runtime/gateway-apply/:id/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: UuidParam,
        body: ApplyResultBodySchema.extend({ node_id: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      try {
        const updated = await applyService.recordResult(req.params.id, req.body.node_id, {
          status: req.body.status,
          error_message: req.body.error_message,
        });

        fireAuditEvent({
          tenant_id: updated.tenant_id ?? '',
          actor_id: null,
          action: updated.status === 'applied' ? 'gateway_apply.applied' : 'gateway_apply.failed',
          resource_type: 'runtime_apply_request',
          resource_id: updated.id,
          metadata: {
            action_type: updated.action_type,
            target_profile: updated.target_profile,
            target_gateway: updated.target_gateway,
            object_type: updated.object_type,
            object_id: updated.object_id,
            error_message: updated.error_message,
          },
        });

        return { data: updated };
      } catch (err) {
        return handleNotFound(err, reply);
      }
    },
  );
};
