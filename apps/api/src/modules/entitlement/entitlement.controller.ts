import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { EntitlementRepository } from './entitlement.repository.js';
import { EntitlementService } from './entitlement.service.js';

const entitlementRepo = new EntitlementRepository(db);
export const entitlementSvc = new EntitlementService(entitlementRepo);

export const commercialController: FastifyPluginAsyncZod = async (app) => {
  // GET /api/v1/commercial/plan — returns plan info for the tenant
  app.get(
    '/plan',
    { preHandler: requireCapability(CAPABILITIES.TENANT_DASHBOARD_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      const plan = await entitlementSvc.getPlanForTenant(user.tenant_id);
      return { data: plan };
    },
  );

  // GET /api/v1/commercial/entitlements — returns all entitlements with limit, current, warning status
  app.get(
    '/entitlements',
    { preHandler: requireCapability(CAPABILITIES.TENANT_DASHBOARD_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      const statuses = await entitlementSvc.getAllUsageStatuses(user.tenant_id);
      return { data: statuses };
    },
  );

  // GET /api/v1/commercial/usage — returns usage status for monthly-counter keys
  app.get(
    '/usage',
    { preHandler: requireCapability(CAPABILITIES.TENANT_DASHBOARD_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      const monthlyKeys = [
        'call_events.monthly_limit',
        'ai.failure_explanation.monthly_limit',
        'ai.route_risk.monthly_limit',
        'ai.summary.monthly_limit',
        'ai.nl_report.monthly_limit',
        'migration.analysis.monthly_limit',
        'migration.draft_import.monthly_limit',
      ];
      const statuses = await Promise.all(
        monthlyKeys.map(key => entitlementSvc.getUsageStatus(user.tenant_id, key)),
      );
      return { data: statuses };
    },
  );
};
