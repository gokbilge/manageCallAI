import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { SupervisorDashboardRepository } from './supervisor-dashboard.repository.js';
import { SupervisorDashboardService } from './supervisor-dashboard.service.js';

const service = new SupervisorDashboardService(new SupervisorDashboardRepository(db));

export const supervisorDashboardController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/dashboard',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_DASHBOARD_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getDashboard(user.tenant_id) };
    },
  );

  app.get(
    '/wallboard',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_DASHBOARD_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getWallboard(user.tenant_id) };
    },
  );
};
