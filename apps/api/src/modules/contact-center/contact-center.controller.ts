import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateDispositionCodeBodySchema,
  CreateQaReviewBodySchema,
  CreateQaScorecardBodySchema,
  UpdateDispositionCodeBodySchema,
  UpdateQaReviewBodySchema,
  UpdateQaScorecardBodySchema,
  UpsertCallDispositionBodySchema,
  UpsertQueueSlaPolicyBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendInvalidArgument, sendNotFound } from '../../errors/index.js';
import { ContactCenterRepository } from './contact-center.repository.js';
import {
  ContactCenterNotFoundError,
  ContactCenterService,
  ContactCenterValidationError,
} from './contact-center.service.js';

const service = new ContactCenterService(new ContactCenterRepository(db));
const CallParamsSchema = z.object({ callId: z.string().min(1) });
const ReviewParamsSchema = z.object({ id: z.string().uuid() });

function replyError(err: unknown, reply: FastifyReply) {
  if (err instanceof ContactCenterNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof ContactCenterValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const contactCenterController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/supervisor/snapshot',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getSupervisorSnapshot(user.tenant_id) };
    },
  );

  app.get(
    '/wallboard',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_WALLBOARD_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      const snapshot = await service.getSupervisorSnapshot(user.tenant_id);
      return {
        data: {
          ...snapshot,
          queue_metrics: snapshot.queue_metrics.filter((metric) => metric.wallboard_enabled),
        },
      };
    },
  );

  app.get(
    '/queues/:id/sla',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getQueueSlaPolicy(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.put(
    '/queues/:id/sla',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_UPDATE),
      schema: { params: UuidParamsSchema, body: UpsertQueueSlaPolicyBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const policy = await service.upsertQueueSlaPolicy(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'contact_center.queue_sla.upserted',
          resource_type: 'queue_sla_policy',
          resource_id: policy.id,
          metadata: { queue_id: req.params.id },
        });
        return { data: policy };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/disposition-codes',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listDispositionCodes(user.tenant_id) };
    },
  );

  app.post(
    '/disposition-codes',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_DISPOSITIONS_MANAGE),
      schema: { body: CreateDispositionCodeBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const code = await service.createDispositionCode(user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'contact_center.disposition_code.created',
          resource_type: 'disposition_code',
          resource_id: code.id,
        });
        return reply.code(201).send({ data: code });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/disposition-codes/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_DISPOSITIONS_MANAGE),
      schema: { params: ReviewParamsSchema, body: UpdateDispositionCodeBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateDispositionCode(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/calls/:callId/disposition',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALLS_VIEW),
      schema: { params: CallParamsSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getCallDisposition(req.params.callId, user.tenant_id) };
    },
  );

  app.put(
    '/calls/:callId/disposition',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_DISPOSITIONS_MANAGE),
      schema: { params: CallParamsSchema, body: UpsertCallDispositionBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const disposition = await service.upsertCallDisposition(req.params.callId, user.tenant_id, user.sub, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'contact_center.call_disposition.upserted',
          resource_type: 'call_disposition',
          resource_id: disposition.id,
          metadata: { call_id: req.params.callId },
        });
        return { data: disposition };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/qa-scorecards',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listQaScorecards(user.tenant_id) };
    },
  );

  app.post(
    '/qa-scorecards',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_QA_MANAGE),
      schema: { body: CreateQaScorecardBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const scorecard = await service.createQaScorecard(user.tenant_id, user.sub, req.body);
        return reply.code(201).send({ data: scorecard });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/qa-scorecards/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_QA_MANAGE),
      schema: { params: ReviewParamsSchema, body: UpdateQaScorecardBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateQaScorecard(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/qa-reviews',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listQaReviews(user.tenant_id) };
    },
  );

  app.post(
    '/qa-reviews',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_QA_MANAGE),
      schema: { body: CreateQaReviewBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const review = await service.createQaReview(user.tenant_id, user.sub, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'contact_center.qa_review.created',
          resource_type: 'qa_review',
          resource_id: review.id,
          metadata: { call_id: review.call_id, status: review.status },
        });
        return reply.code(201).send({ data: review });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/qa-reviews/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONTACT_CENTER_QA_MANAGE),
      schema: { params: ReviewParamsSchema, body: UpdateQaReviewBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateQaReview(req.params.id, user.tenant_id, user.sub, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
