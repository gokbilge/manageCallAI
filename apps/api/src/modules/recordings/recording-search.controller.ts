import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { RecordingSearchRepository } from './recording-search.repository.js';
import { RecordingSearchService } from './recording-search.service.js';

const service = new RecordingSearchService(new RecordingSearchRepository(db));

const SearchBodySchema = z.object({
  query: z.string().min(1).max(500),
  filter: z.object({
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    call_id: z.string().optional(),
  }).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const recordingSearchController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/search',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: { body: SearchBodySchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const result = await service.search(user.tenant_id, req.body);

      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role ?? null,
        action: 'recordings.search',
        resource_type: 'recording',
        resource_id: null,
        metadata: {
          query_length: req.body.query.length,
          mode: result.mode,
          total_results: result.total,
          filter: req.body.filter ?? null,
        },
      });

      return { data: result };
    },
  );
};
