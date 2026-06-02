import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { RetentionRepository } from './retention.repository.js';
import { LegalHoldNotFoundError, RetentionBoundsError, RetentionService } from './retention.service.js';

const repo = new RetentionRepository(db);
const service = new RetentionService(repo);

const RESOURCE_TYPES = ['recording', 'voicemail', 'transcript', 'summary', 'cdr', 'call_event', 'generated_media', 'all'] as const;

const RetentionPatchSchema = z.object({
  recording_retention_days: z.number().int().positive().nullable().optional(),
  voicemail_retention_days: z.number().int().positive().nullable().optional(),
  transcript_retention_days: z.number().int().positive().nullable().optional(),
  ai_summary_retention_days: z.number().int().positive().nullable().optional(),
  cdr_retention_days: z.number().int().positive().nullable().optional(),
  call_event_retention_days: z.number().int().positive().nullable().optional(),
  generated_media_retention_days: z.number().int().positive().nullable().optional(),
});

const CreateLegalHoldSchema = z.object({
  resource_type: z.enum(RESOURCE_TYPES),
  resource_id: z.string().max(255).nullable().optional(),
  case_reference: z.string().max(255).nullable().optional(),
  reason: z.string().min(1).max(1000),
  expires_at: z.string().datetime().nullable().optional(),
});

export const retentionController: FastifyPluginAsyncZod = async (app) => {
  // ── Retention policy ──────────────────────────────────────────────────────

  app.get(
    '/retention',
    { preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN) },
    async (req) => {
      const user = req.user as AuthClaims;
      const policy = await service.getPolicy(user.tenant_id);
      return { data: policy };
    },
  );

  app.patch(
    '/retention',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: { body: RetentionPatchSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const policy = await service.updatePolicy(user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'retention.policy.update',
          resource_type: 'tenant_retention_policy',
          resource_id: user.tenant_id,
          metadata: req.body,
        });
        return { data: policy };
      } catch (err) {
        if (err instanceof RetentionBoundsError) {
          return sendInvalidArgument(reply, err.message);
        }
        throw err;
      }
    },
  );

  // ── Legal holds ───────────────────────────────────────────────────────────

  app.get(
    '/legal-holds',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: { querystring: z.object({ all: z.enum(['true', 'false']).optional() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const activeOnly = req.query.all !== 'true';
      const holds = await service.listLegalHolds(user.tenant_id, activeOnly);
      return { data: holds };
    },
  );

  app.post(
    '/legal-hold',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: { body: CreateLegalHoldSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const hold = await service.createLegalHold(user.tenant_id, {
        ...req.body,
        initiated_by: user.sub,
      });
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'retention.legal_hold.create',
        resource_type: 'legal_hold',
        resource_id: hold.id,
        metadata: {
          resource_type: hold.resource_type,
          resource_id: hold.resource_id,
          case_reference: hold.case_reference,
        },
      });
      return reply.code(201).send({ data: hold });
    },
  );

  app.delete(
    '/legal-hold/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const hold = await service.releaseLegalHold(req.params.id, user.tenant_id, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'retention.legal_hold.release',
          resource_type: 'legal_hold',
          resource_id: hold.id,
          metadata: { case_reference: hold.case_reference },
        });
        return { data: hold };
      } catch (err) {
        if (err instanceof LegalHoldNotFoundError) {
          return sendNotFound(reply, err.message);
        }
        throw err;
      }
    },
  );
};
