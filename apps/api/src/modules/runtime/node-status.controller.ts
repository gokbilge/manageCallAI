import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { authenticateRuntime } from './runtime-auth.js';
import { authenticate } from '../auth/authenticate.js';
import { sendNotFound } from '../../errors/index.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { NodeStatusRepository } from './node-status.repository.js';
const repo = new NodeStatusRepository(db);

const UuidParam = z.object({ id: z.string().uuid() });

const UpsertBodySchema = z.object({
  node_id: z.string().uuid(),
  freeswitch_version: z.string().nullable().optional(),
  loaded_modules: z.array(z.string()).optional(),
  missing_required_modules: z.array(z.string()).optional(),
  sofia_profiles: z.record(z.object({ state: z.string() })).optional(),
  gateway_statuses: z.record(z.object({
    state: z.string(),
    ping_ms: z.number().nullable().optional(),
  })).optional(),
  active_channel_count: z.number().int().nullable().optional(),
  active_registration_count: z.number().int().nullable().optional(),
});

function requirePlatformAdmin(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const user = req.user as AuthClaims | undefined;
  if (!user || user.role !== 'platform_admin') {
    reply.code(403).send({ error: 'FORBIDDEN', message: 'Platform admin access required' });
    return;
  }
  done();
}

function requireTenantAdmin(req: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const user = req.user as AuthClaims | undefined;
  if (!user || (user.role !== 'tenant_admin' && user.role !== 'platform_admin')) {
    reply.code(403).send({ error: 'FORBIDDEN', message: 'Tenant admin access required' });
    return;
  }
  done();
}

export const nodeStatusController: FastifyPluginAsyncZod = async (app) => {
  // ── Runtime callback: Go agent pushes status snapshot ─────────────────────
  app.post(
    '/nodes/:id/status-snapshot',
    {
      preHandler: authenticateRuntime,
      schema: { params: UuidParam, body: UpsertBodySchema },
    },
    async (req) => {
      const snapshot = await repo.upsert({ ...req.body, node_id: req.params.id });
      return { data: snapshot };
    },
  );

  // ── Platform admin: read-only node status ─────────────────────────────────
  app.get(
    '/nodes/:id/status',
    {
      preHandler: [authenticate, requirePlatformAdmin],
      schema: { params: UuidParam },
    },
    async (req, reply) => {
      const snapshot = await repo.findByNode(req.params.id);
      if (!snapshot) return sendNotFound(reply, `No status snapshot for node ${req.params.id}`);
      return { data: snapshot };
    },
  );

  app.get(
    '/nodes/:id/modules',
    {
      preHandler: [authenticate, requirePlatformAdmin],
      schema: { params: UuidParam },
    },
    async (req, reply) => {
      const snapshot = await repo.findByNode(req.params.id);
      if (!snapshot) return sendNotFound(reply, `No status snapshot for node ${req.params.id}`);
      return {
        data: {
          node_id: snapshot.node_id,
          queried_at: snapshot.queried_at,
          loaded_modules: snapshot.loaded_modules,
          missing_required_modules: snapshot.missing_required_modules,
        },
      };
    },
  );

  app.get(
    '/nodes/:id/gateways',
    {
      preHandler: [authenticate, requirePlatformAdmin],
      schema: { params: UuidParam },
    },
    async (req, reply) => {
      const snapshot = await repo.findByNode(req.params.id);
      if (!snapshot) return sendNotFound(reply, `No status snapshot for node ${req.params.id}`);
      return {
        data: {
          node_id: snapshot.node_id,
          queried_at: snapshot.queried_at,
          sofia_profiles: snapshot.sofia_profiles,
          gateway_statuses: snapshot.gateway_statuses,
        },
      };
    },
  );

  app.get(
    '/nodes/:id/channels',
    {
      preHandler: [authenticate, requirePlatformAdmin],
      schema: { params: UuidParam },
    },
    async (req, reply) => {
      const snapshot = await repo.findByNode(req.params.id);
      if (!snapshot) return sendNotFound(reply, `No status snapshot for node ${req.params.id}`);
      return {
        data: {
          node_id: snapshot.node_id,
          queried_at: snapshot.queried_at,
          active_channel_count: snapshot.active_channel_count,
          active_registration_count: snapshot.active_registration_count,
        },
      };
    },
  );

  app.get(
    '/nodes/:id/registrations',
    {
      preHandler: [authenticate, requirePlatformAdmin],
      schema: { params: UuidParam },
    },
    async (req, reply) => {
      const snapshot = await repo.findByNode(req.params.id);
      if (!snapshot) return sendNotFound(reply, `No status snapshot for node ${req.params.id}`);
      return {
        data: {
          node_id: snapshot.node_id,
          queried_at: snapshot.queried_at,
          active_registration_count: snapshot.active_registration_count,
        },
      };
    },
  );
};

// Tenant-admin endpoint: own gateways only (their trunks' gateway states from the latest snapshot)
export const tenantGatewayStatusController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/gateway-status',
    { preHandler: [authenticate, requireTenantAdmin] },
    async (req) => {
      const user = req.user as AuthClaims;
      // Filter to this tenant's trunks by querying the DB
      const tenantTrunks = await db.query<{ id: string; name: string }>(
        `SELECT id, name FROM sip_trunks WHERE tenant_id = $1 AND status = 'active'`,
        [user.tenant_id],
      );
      const tenantTrunkIds = new Set(tenantTrunks.rows.map(t => t.id));

      // Gather gateway statuses across all node snapshots for this tenant's gateways
      const allSnapshots = await new NodeStatusRepository(db).findAll();
      const result: Array<{
        trunk_id: string;
        trunk_name: string;
        node_id: string;
        state: string;
        queried_at: Date;
      }> = [];

      for (const snapshot of allSnapshots) {
        const statuses = snapshot.gateway_statuses as Record<string, { state: string }>;
        for (const [gwName, gwStatus] of Object.entries(statuses)) {
          // Gateway names follow the convention "trunk-{id}"
          const trunkId = gwName.replace(/^trunk-/, '');
          if (tenantTrunkIds.has(trunkId)) {
            const trunk = tenantTrunks.rows.find(t => t.id === trunkId);
            result.push({
              trunk_id: trunkId,
              trunk_name: trunk?.name ?? gwName,
              node_id: snapshot.node_id,
              state: gwStatus.state,
              queried_at: snapshot.queried_at,
            });
          }
        }
      }

      return { data: result };
    },
  );
};
