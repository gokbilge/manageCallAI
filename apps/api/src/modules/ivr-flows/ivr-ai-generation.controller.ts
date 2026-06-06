import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  UuidParamsSchema,
  CreateIvrGenerationBodySchema,
  CreateIvrAiPatchBodySchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { AiPolicyRepository } from '../ai-policy/ai-policy.repository.js';
import { AiPolicyService, AiProviderRequestDeniedError } from '../ai-policy/ai-policy.service.js';
import { ProviderWorkRepository } from '../provider-work/provider-work.repository.js';
import { ProviderWorkRequestNotFoundError, ProviderWorkService } from '../provider-work/provider-work.service.js';
import { IvrFlowRepository } from './ivr-flow.repository.js';
import { IvrFlowNotFoundError, IvrFlowService } from './ivr-flow.service.js';
import { defaultIvrGraph } from './ivr-flow.validation.js';
import { sendNotFound, sendFailedPrecondition, sendPermissionDenied, sendInvalidArgument } from '../../errors/index.js';

const aiPolicyService = new AiPolicyService(new AiPolicyRepository(db));
const workService = new ProviderWorkService(new ProviderWorkRepository(db), aiPolicyService);
const ivrService = new IvrFlowService(new IvrFlowRepository(db));

function requireProviderBackedCapability(user: AuthClaims): boolean {
  const caps = user.capabilities;
  if (caps !== undefined) {
    return caps.includes('*') || caps.includes(CAPABILITIES.TENANT_AI_PROVIDER_BACKED_USE);
  }
  return user.role === 'tenant_admin' || user.role === 'tenant_operator' || user.role === 'platform_admin';
}

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ProviderWorkRequestNotFoundError || err instanceof IvrFlowNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  if (err instanceof AiProviderRequestDeniedError) {
    return sendFailedPrecondition(reply, (err as Error).message);
  }
  throw err;
}

const idPidParams = z.object({ id: z.string().uuid(), pid: z.string().uuid() });

// ── IVR generation (#253) ────────────────────────────────────────────────────

export const ivrGenerationController: FastifyPluginAsyncZod = async (app) => {
  // List generation requests
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await workService.listIvrGenerations(user.tenant_id) };
    },
  );

  // Get a specific generation request
  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await workService.getIvrGeneration(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Create a generation request + draft IVR flow
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_CREATE),
      schema: { body: CreateIvrGenerationBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      if ((req.body.provider_hint ?? 'auto') !== 'auto' && !requireProviderBackedCapability(user)) {
        return sendPermissionDenied(reply, 'Provider-backed AI use requires tenant.ai.provider_backed.use');
      }

      try {
        const generationRequest = await workService.createIvrGeneration(user.tenant_id, req.body);

        // Create a draft IVR flow immediately so operators can work with it
        const flow = await ivrService.create({
          tenant_id: user.tenant_id,
          name: req.body.flow_name,
          graph_json: defaultIvrGraph(),
          created_by: user.sub,
          metadata: {
            ai_lineage: {
              ai_assisted: true,
              actor: { actor_type: 'user' },
              source_request_type: 'ivr_generation',
              source_request_id: generationRequest.id,
              normalized_input: req.body.intent,
              provider: req.body.provider_hint ?? 'auto',
              risk_level: 'low',
              requires_human_approval: true,
            },
          },
        });

        const draftVersion = flow.versions[0];
        if (draftVersion) {
          await workService.linkIvrGenerationToFlow(generationRequest.id, flow.id, draftVersion.id);
        }

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.ivr_generation.requested',
          resource_type: 'ivr_generation_request',
          resource_id: generationRequest.id,
          metadata: {
            flow_id: flow.id,
            provider_hint: generationRequest.provider_hint,
            policy: generationRequest.metadata['ai_policy'] ?? null,
          },
        });

        return reply.code(201).send({ data: { generation_request: generationRequest, flow } });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// ── IVR AI patches (#254) — on /ivr-flows/:id/ai-patches ─────────────────────

export const ivrAiPatchController: FastifyPluginAsyncZod = async (app) => {
  // List patch requests for an IVR flow
  app.get(
    '/:id/ai-patches',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const flow = await ivrService.getById(req.params.id, user.tenant_id);
        return { data: await workService.listIvrAiPatches(user.tenant_id, 'ivr_flow', flow.id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Get a specific patch request
  app.get(
    '/:id/ai-patches/:pid',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: idPidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await workService.getIvrAiPatch(req.params.pid, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Create an AI patch request for an IVR flow draft
  app.post(
    '/:id/ai-patches',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: CreateIvrAiPatchBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      if ((req.body.provider_hint ?? 'auto') !== 'auto' && !requireProviderBackedCapability(user)) {
        return sendPermissionDenied(reply, 'Provider-backed AI use requires tenant.ai.provider_backed.use');
      }

      try {
        const flow = await ivrService.getById(req.params.id, user.tenant_id);
        if (!flow.draft_version_id) {
          return sendInvalidArgument(reply, 'IVR flow has no draft version to patch');
        }

        const patchRequest = await workService.createIvrAiPatch(user.tenant_id, {
          target_type: 'ivr_flow',
          target_id: flow.id,
          version_id: flow.draft_version_id,
          intent: req.body.intent,
          provider_hint: req.body.provider_hint,
          metadata: req.body.metadata,
        });

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.ivr_patch.requested',
          resource_type: 'ivr_ai_patch_request',
          resource_id: patchRequest.id,
          metadata: {
            flow_id: flow.id,
            version_id: flow.draft_version_id,
            provider_hint: patchRequest.provider_hint,
            policy: patchRequest.metadata['ai_policy'] ?? null,
          },
        });

        return reply.code(201).send({ data: patchRequest });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Accept a completed patch — applies the diff to the flow's draft version
  app.post(
    '/:id/ai-patches/:pid/accept',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: { params: idPidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const patchRequest = await workService.getIvrAiPatch(req.params.pid, user.tenant_id);

        if (patchRequest.target_type !== 'ivr_flow' || patchRequest.target_id !== req.params.id) {
          return sendNotFound(reply, 'Patch request not found for this flow');
        }
        if (patchRequest.status !== 'completed') {
          return sendFailedPrecondition(reply, `Patch must be in 'completed' state to accept (current: ${patchRequest.status})`);
        }
        if (!patchRequest.diff_json) {
          return sendFailedPrecondition(reply, 'Patch has no diff to apply');
        }

        const flow = await ivrService.getById(req.params.id, user.tenant_id);
        const targetVersionId = patchRequest.version_id ?? flow.draft_version_id;
        if (!targetVersionId) {
          return sendFailedPrecondition(reply, 'IVR flow has no draft version to patch');
        }

        const currentVersion = await ivrService.getVersion(flow.id, targetVersionId, user.tenant_id);
        const patchedGraph = applyIvrDiff(currentVersion.graph_json, patchRequest.diff_json);

        const newVersion = await ivrService.createVersion(
          flow.id,
          user.tenant_id,
          patchedGraph,
          user.sub,
          {
            ai_lineage: {
              ai_assisted: true,
              actor: { actor_type: 'user' },
              source_request_type: 'ivr_ai_patch',
              source_request_id: patchRequest.id,
              normalized_input: patchRequest.intent,
              provider: patchRequest.provider_hint,
              risk_level: patchRequest.risk_level ?? 'low',
              risk_summary: patchRequest.risk_summary ?? null,
              requires_human_approval: true,
            },
          },
        );

        const accepted = await workService.acceptIvrAiPatch(req.params.pid, user.tenant_id, user.sub);

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.ivr_patch.accepted',
          resource_type: 'ivr_ai_patch_request',
          resource_id: patchRequest.id,
          metadata: {
            flow_id: flow.id,
            new_version_id: newVersion.id,
            risk_level: patchRequest.risk_level,
          },
        });

        return { data: { patch_request: accepted, new_version: newVersion } };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Reject a completed patch — no changes applied
  app.post(
    '/:id/ai-patches/:pid/reject',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: { params: idPidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const patchRequest = await workService.getIvrAiPatch(req.params.pid, user.tenant_id);

        if (patchRequest.target_type !== 'ivr_flow' || patchRequest.target_id !== req.params.id) {
          return sendNotFound(reply, 'Patch request not found for this flow');
        }
        if (patchRequest.status !== 'completed') {
          return sendFailedPrecondition(reply, `Patch must be in 'completed' state to reject (current: ${patchRequest.status})`);
        }

        const rejected = await workService.rejectIvrAiPatch(req.params.pid, user.tenant_id, user.sub);

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.ivr_patch.rejected',
          resource_type: 'ivr_ai_patch_request',
          resource_id: patchRequest.id,
          metadata: { flow_id: req.params.id },
        });

        return { data: rejected };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// ── IVR AI patches for inbound routes (#254) — on /inbound-routes/:id/ai-patches

export const inboundRouteAiPatchController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/:id/ai-patches',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await workService.listIvrAiPatches(user.tenant_id, 'inbound_route', req.params.id) };
    },
  );

  app.get(
    '/:id/ai-patches/:pid',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
      schema: { params: idPidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await workService.getIvrAiPatch(req.params.pid, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/ai-patches',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: CreateIvrAiPatchBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      if ((req.body.provider_hint ?? 'auto') !== 'auto' && !requireProviderBackedCapability(user)) {
        return sendPermissionDenied(reply, 'Provider-backed AI use requires tenant.ai.provider_backed.use');
      }

      try {
        const patchRequest = await workService.createIvrAiPatch(user.tenant_id, {
          target_type: 'inbound_route',
          target_id: req.params.id,
          intent: req.body.intent,
          provider_hint: req.body.provider_hint,
          metadata: req.body.metadata,
        });

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.route_patch.requested',
          resource_type: 'ivr_ai_patch_request',
          resource_id: patchRequest.id,
          metadata: {
            route_id: req.params.id,
            provider_hint: patchRequest.provider_hint,
          },
        });

        return reply.code(201).send({ data: patchRequest });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/ai-patches/:pid/accept',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: { params: idPidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const patchRequest = await workService.getIvrAiPatch(req.params.pid, user.tenant_id);

        if (patchRequest.target_type !== 'inbound_route' || patchRequest.target_id !== req.params.id) {
          return sendNotFound(reply, 'Patch request not found for this route');
        }
        if (patchRequest.status !== 'completed') {
          return sendFailedPrecondition(reply, `Patch must be in 'completed' state to accept (current: ${patchRequest.status})`);
        }

        const accepted = await workService.acceptIvrAiPatch(req.params.pid, user.tenant_id, user.sub);

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.route_patch.accepted',
          resource_type: 'ivr_ai_patch_request',
          resource_id: patchRequest.id,
          metadata: { route_id: req.params.id, risk_level: patchRequest.risk_level },
        });

        return { data: accepted };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/ai-patches/:pid/reject',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: { params: idPidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const patchRequest = await workService.getIvrAiPatch(req.params.pid, user.tenant_id);

        if (patchRequest.target_type !== 'inbound_route' || patchRequest.target_id !== req.params.id) {
          return sendNotFound(reply, 'Patch request not found for this route');
        }
        if (patchRequest.status !== 'completed') {
          return sendFailedPrecondition(reply, `Patch must be in 'completed' state to reject (current: ${patchRequest.status})`);
        }

        const rejected = await workService.rejectIvrAiPatch(req.params.pid, user.tenant_id, user.sub);

        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.route_patch.rejected',
          resource_type: 'ivr_ai_patch_request',
          resource_id: patchRequest.id,
          metadata: { route_id: req.params.id },
        });

        return { data: rejected };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// ── IVR graph diff application ───────────────────────────────────────────────

function applyIvrDiff(
  base: Record<string, unknown>,
  diff: Record<string, unknown>,
): Record<string, unknown> {
  const nodes = Array.isArray(base.nodes) ? [...(base.nodes as Record<string, unknown>[])] : [];
  const edges = Array.isArray(base.edges) ? [...(base.edges as Record<string, unknown>[])] : [];

  const nodesDiff = diff.nodes as Record<string, unknown[]> | undefined;
  const edgesDiff = diff.edges as Record<string, unknown[]> | undefined;

  if (nodesDiff) {
    const toAdd = (nodesDiff.add ?? []) as Record<string, unknown>[];
    const toRemove = new Set((nodesDiff.remove ?? []) as string[]);
    const toModify = ((nodesDiff.modify ?? []) as Array<{ id: string; patch: Record<string, unknown> }>);

    const filtered = nodes.filter((n) => !toRemove.has(String(n.id)));
    const modifiedMap = new Map(toModify.map((m) => [m.id, m.patch]));
    const patched = filtered.map((n) => {
      const patch = modifiedMap.get(String(n.id));
      return patch ? { ...n, ...patch } : n;
    });
    nodes.splice(0, nodes.length, ...patched, ...toAdd);
  }

  if (edgesDiff) {
    const toAdd = (edgesDiff.add ?? []) as Record<string, unknown>[];
    const toRemove = new Set((edgesDiff.remove ?? []) as string[]);
    const toModify = ((edgesDiff.modify ?? []) as Array<{ id: string; patch: Record<string, unknown> }>);

    const filtered = edges.filter((e) => !toRemove.has(String(e.id)));
    const modifiedMap = new Map(toModify.map((m) => [m.id, m.patch]));
    const patched = filtered.map((e) => {
      const patch = modifiedMap.get(String(e.id));
      return patch ? { ...e, ...patch } : e;
    });
    edges.splice(0, edges.length, ...patched, ...toAdd);
  }

  return { ...base, nodes, edges };
}
