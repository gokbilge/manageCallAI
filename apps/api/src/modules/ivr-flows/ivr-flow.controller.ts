import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  UuidParamsSchema,
  UpdateIvrFlowBodySchema,
  SimulationScenarioSchema,
} from '@managecallai/contracts';
import { computeReachableBranches } from './ivr-flow.validation.js';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireWebhooks } from '../automation/webhook-delivery.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { IvrFlowRepository } from './ivr-flow.repository.js';
import {
  FlowVersionNotFoundError,
  FlowVersionStateError,
  IvrFlowNotFoundError,
  IvrFlowService,
  RollbackNotAvailableError,
} from './ivr-flow.service.js';
import { defaultIvrGraph } from './ivr-flow.validation.js';
import { sendNotFound, sendFailedPrecondition } from '../../errors/index.js';

const service = new IvrFlowService(new IvrFlowRepository(db));

function extractNodes(graph: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  if (!graph) return [];
  return Array.isArray(graph.nodes) ? graph.nodes as Array<Record<string, unknown>> : [];
}

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof IvrFlowNotFoundError || err instanceof FlowVersionNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof FlowVersionStateError || err instanceof RollbackNotAvailableError) {
    return sendFailedPrecondition(reply, err.message);
  }
  throw err;
}

const idVidParams = z.object({ id: z.string().uuid(), vid: z.string().uuid() });

const graphBodySchema = z.object({
  graph_json: z.record(z.unknown()).optional(),
  definition: z.record(z.unknown()).optional(),
});

export const ivrFlowController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_CREATE),
      schema: {
        body: z.object({
          name: z.string().min(1).max(255),
          description: z.string().max(1000).optional(),
          graph_json: z.record(z.unknown()).optional(),
          definition: z.record(z.unknown()).optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const flow = await service.create({
        tenant_id: user.tenant_id,
        name: req.body.name,
        description: req.body.description,
        graph_json: req.body.graph_json ?? req.body.definition ?? defaultIvrGraph(),
        created_by: user.sub,
      });
      return reply.code(201).send({ data: flow });
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateIvrFlowBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/versions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listVersions(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/history',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        params: UuidParamsSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getHistory(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/versions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: graphBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const version = await service.createVersion(req.params.id, user.tenant_id, req.body.graph_json ?? req.body.definition, user.sub);
        return reply.code(201).send({ data: version });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/versions/:vid',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        params: idVidParams,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getVersion(req.params.id, req.params.vid, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id/versions/:vid',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: idVidParams,
        body: graphBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return {
          data: await service.updateVersionDefinition(
            req.params.id,
            req.params.vid,
            user.tenant_id,
            req.body.graph_json ?? req.body.definition ?? defaultIvrGraph(),
          ),
        };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/validate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE),
      schema: {
        params: UuidParamsSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.validateCurrentDraft(req.params.id, user.tenant_id);
        if (result.outcome.status !== 'passed') {
          fireWebhooks(user.tenant_id, 'ivr_flow.validation_failed', {
            flow_id: req.params.id,
            errors: result.outcome.errors ?? [],
          });
        }
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/versions/:vid/validate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE),
      schema: {
        params: idVidParams,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.validate(req.params.id, req.params.vid, user.tenant_id);
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/simulate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE),
      schema: {
        params: UuidParamsSchema,
        body: SimulationScenarioSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.simulateCurrentDraft(req.params.id, user.tenant_id, req.body ?? {});
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/versions/:vid/simulate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE),
      schema: {
        params: idVidParams,
        body: SimulationScenarioSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.simulate(req.params.id, req.params.vid, user.tenant_id, req.body ?? {});
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/versions/:vid/publish',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH),
      schema: {
        params: idVidParams,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.publish(req.params.id, req.params.vid, user.tenant_id, user.sub, user.role);
        const event = result.status === 'pending_approval' ? 'ivr_flow.publish_pending' : 'ivr_flow.published';
        fireWebhooks(user.tenant_id, event, { flow_id: req.params.id, version_id: req.params.vid });
        fireAuditEvent({ tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role, action: event, resource_type: 'ivr_flow', resource_id: req.params.id, metadata: { version_id: req.params.vid } });
        const statusCode = result.status === 'pending_approval' ? 202 : 200;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Graph diff: compare draft version against the current active version.
  app.get(
    '/:id/diff',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const flow = await service.getById(req.params.id, user.tenant_id);
        const draftVersion = flow.versions.find((v) => v.id === flow.draft_version_id);
        const activeVersion = flow.versions.find((v) => v.id === flow.active_version_id);

        if (!draftVersion) return sendNotFound(reply, 'No draft version found');

        const draftNodes = extractNodes(draftVersion.graph_json);
        const activeNodes = extractNodes(activeVersion?.graph_json);

        const draftIds = new Set(draftNodes.map((n) => n.id));
        const activeIds = new Set(activeNodes.map((n) => n.id));

        const added = draftNodes.filter((n) => !activeIds.has(n.id));
        const removed = activeNodes.filter((n) => !draftIds.has(n.id));
        const modified = draftNodes.filter((n) => {
          if (!activeIds.has(n.id)) return false;
          const activeNode = activeNodes.find((a) => a.id === n.id);
          return JSON.stringify(n) !== JSON.stringify(activeNode);
        });
        const unchanged = draftNodes.filter((n) => {
          if (!activeIds.has(n.id)) return false;
          const activeNode = activeNodes.find((a) => a.id === n.id);
          return JSON.stringify(n) === JSON.stringify(activeNode);
        });

        return {
          data: {
            flow_id: flow.id,
            draft_version_id: flow.draft_version_id,
            active_version_id: flow.active_version_id ?? null,
            summary: {
              added: added.length,
              removed: removed.length,
              modified: modified.length,
              unchanged: unchanged.length,
            },
            added,
            removed,
            modified: modified.map((n) => ({
              id: n.id,
              draft: n,
              active: activeNodes.find((a) => a.id === n.id) ?? null,
            })),
          },
        };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Simulation coverage: which nodes in the draft have been visited in at least one simulation.
  app.get(
    '/:id/simulation-coverage',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const flow = await service.getById(req.params.id, user.tenant_id);
        const draftVersion = flow.versions.find((v) => v.id === flow.draft_version_id);
        if (!draftVersion) return sendNotFound(reply, 'No draft version found');

        const allNodeIds = computeReachableBranches(draftVersion.graph_json);

        // Find all node ids visited in simulation results for this version.
        const simResults = await service.getHistory(req.params.id, user.tenant_id);
        const visitedIds = new Set<string>();
        for (const sim of simResults.simulations) {
          const path = (sim.result_payload as Record<string, unknown>)?.path;
          if (Array.isArray(path)) {
            for (const nodeId of path as string[]) visitedIds.add(nodeId);
          }
        }

        const coverage: Record<string, 'tested' | 'untested'> = {};
        for (const id of allNodeIds) {
          coverage[id] = visitedIds.has(id) ? 'tested' : 'untested';
        }

        const testedCount = Object.values(coverage).filter((v) => v === 'tested').length;
        const totalCount = allNodeIds.size;

        return {
          data: {
            flow_id: flow.id,
            draft_version_id: flow.draft_version_id,
            coverage_pct: totalCount === 0 ? 100 : Math.round((testedCount / totalCount) * 100),
            tested_count: testedCount,
            total_count: totalCount,
            nodes: coverage,
          },
        };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/rollback',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_ROLLBACK),
      schema: {
        params: UuidParamsSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.rollback(req.params.id, user.tenant_id, user.sub, user.role);
        fireWebhooks(user.tenant_id, 'ivr_flow.rollback_completed', { flow_id: req.params.id });
        fireAuditEvent({ tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role, action: 'ivr_flow.rollback_completed', resource_type: 'ivr_flow', resource_id: req.params.id });
        const statusCode = result.status === 'pending_approval' ? 202 : 200;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
