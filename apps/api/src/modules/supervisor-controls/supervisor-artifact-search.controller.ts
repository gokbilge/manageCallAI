import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { SupervisorArtifactSearchRepository } from './supervisor-artifact-search.repository.js';
import { SupervisorArtifactSearchService } from './supervisor-artifact-search.service.js';
import { ArtifactSearchBodySchema } from '@managecallai/contracts';

const service = new SupervisorArtifactSearchService(new SupervisorArtifactSearchRepository(db));

export const supervisorArtifactSearchController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/search',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_ARTIFACT_SEARCH),
      schema: { body: ArtifactSearchBodySchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const result = await service.search(user.tenant_id, req.body);

      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role ?? null,
        action: 'supervisor.artifact_search',
        resource_type: 'artifact_search',
        resource_id: null,
        metadata: {
          query_length: req.body.query.length,
          total_results: result.total,
          artifact_types: req.body.filter?.artifact_types ?? ['recording', 'note', 'disposition'],
        },
      });

      return { data: result };
    },
  );
};
