import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ExportRepository } from './export.repository.js';
import { ExportService } from './export.service.js';

const service = new ExportService(new ExportRepository(db));

const EXPORT_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    since: { type: 'string', format: 'date-time' },
    until: { type: 'string', format: 'date-time' },
    limit: { type: 'string' },
  },
} as const;

type ExportQuery = { since?: string; until?: string; limit?: string };

export async function exportController(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ExportQuery }>(
    '/call-events',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXPORT_RUN),
      schema: { querystring: EXPORT_QUERY_SCHEMA },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const { since, until, limit } = req.query;
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const rows = await service.exportCallEvents(user.tenant_id, {
        since,
        until,
        limit: parsedLimit && !isNaN(parsedLimit) ? parsedLimit : undefined,
      });
      return { data: rows, count: rows.length };
    },
  );

  app.get<{ Querystring: ExportQuery }>(
    '/sessions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXPORT_RUN),
      schema: { querystring: EXPORT_QUERY_SCHEMA },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const { since, until, limit } = req.query;
      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const rows = await service.exportSessions(user.tenant_id, {
        since,
        until,
        limit: parsedLimit && !isNaN(parsedLimit) ? parsedLimit : undefined,
      });
      return { data: rows, count: rows.length };
    },
  );
}
