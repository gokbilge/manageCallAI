import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import { QaScoringRepository } from './qa-scoring.repository.js';
import {
  QaScoringService,
  QaTemplateNotFoundError,
  QaCriterionNotFoundError,
  QaReviewNotFoundError,
  QaReviewValidationError,
} from './qa-scoring.service.js';
import {
  CreateQaTemplateBodySchema,
  UpdateQaTemplateBodySchema,
  CreateQaCriterionBodySchema,
  UpdateQaCriterionBodySchema,
  CreateQaReviewBodySchema,
  SubmitQaReviewBodySchema,
  DisputeQaReviewBodySchema,
  QaReviewStatusSchema,
} from '@managecallai/contracts';

const UuidParamSchema = z.object({ id: z.string().uuid() });
const TemplateAndCriterionSchema = z.object({ id: z.string().uuid(), criterionId: z.string().uuid() });
const ReviewParamSchema = z.object({ id: z.string().uuid() });

const service = new QaScoringService(new QaScoringRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof QaTemplateNotFoundError || err instanceof QaCriterionNotFoundError || err instanceof QaReviewNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  if (err instanceof QaReviewValidationError) {
    return sendInvalidArgument(reply, (err as Error).message);
  }
  throw err;
}

// ── QA scorecard templates ────────────────────────────────────────────────────

export const qaTemplateController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listTemplates(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_MANAGE),
      schema: { body: CreateQaTemplateBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const tmpl = await service.createTemplate({ ...req.body, tenant_id: user.tenant_id });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'qa.template.created',
          resource_type: 'qa_scorecard_template',
          resource_id: tmpl.id,
          metadata: { name: tmpl.name },
        });
        return reply.code(201).send({ data: tmpl });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_VIEW),
      schema: { params: UuidParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getTemplate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_MANAGE),
      schema: { params: UuidParamSchema, body: UpdateQaTemplateBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateTemplate(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // ── Criteria sub-resource ──────────────────────────────────────────────────

  app.get(
    '/:id/criteria',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_VIEW),
      schema: { params: UuidParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listCriteria(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/criteria',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_MANAGE),
      schema: { params: UuidParamSchema, body: CreateQaCriterionBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const criterion = await service.createCriterion({
          ...req.body,
          tenant_id: user.tenant_id,
          template_id: req.params.id,
        });
        return reply.code(201).send({ data: criterion });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id/criteria/:criterionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_MANAGE),
      schema: { params: TemplateAndCriterionSchema, body: UpdateQaCriterionBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateCriterion(req.params.criterionId, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/criteria/:criterionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_SCORECARDS_MANAGE),
      schema: { params: TemplateAndCriterionSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.deleteCriterion(req.params.criterionId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// ── QA reviews ────────────────────────────────────────────────────────────────

export const qaReviewController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_REVIEWS_VIEW),
      schema: {
        querystring: z.object({
          call_id: z.string().optional(),
          agent_profile_id: z.string().uuid().optional(),
          status: QaReviewStatusSchema.optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listReviews(user.tenant_id, req.query) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_REVIEWS_MANAGE),
      schema: { body: CreateQaReviewBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const review = await service.createReview({ ...req.body, tenant_id: user.tenant_id }, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'qa.review.created',
          resource_type: 'qa_review',
          resource_id: review.id,
          metadata: { call_id: review.call_id, template_id: review.template_id },
        });
        return reply.code(201).send({ data: review });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_REVIEWS_VIEW),
      schema: { params: ReviewParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getReview(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/submit',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_REVIEWS_MANAGE),
      schema: { params: ReviewParamSchema, body: SubmitQaReviewBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const review = await service.submitReview(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'qa.review.submitted',
          resource_type: 'qa_review',
          resource_id: review.id,
          metadata: { overall_score: review.overall_score },
        });
        return { data: review };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/dispute',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_REVIEWS_MANAGE),
      schema: { params: ReviewParamSchema, body: DisputeQaReviewBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const review = await service.disputeReview(req.params.id, user.tenant_id, user.sub, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'qa.review.disputed',
          resource_type: 'qa_review',
          resource_id: review.id,
          metadata: { dispute_reason: req.body.dispute_reason },
        });
        return { data: review };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/finalize',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QA_REVIEWS_MANAGE),
      schema: { params: ReviewParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const review = await service.finalizeReview(req.params.id, user.tenant_id, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'qa.review.finalized',
          resource_type: 'qa_review',
          resource_id: review.id,
          metadata: {},
        });
        return { data: review };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
