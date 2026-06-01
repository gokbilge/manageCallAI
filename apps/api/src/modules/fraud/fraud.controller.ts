import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { FraudRepository } from './fraud.repository.js';
import { FraudService } from './fraud.service.js';

const repo = new FraudRepository(db);
const service = new FraudService(repo);

const PrefixListSchema = z.array(z.string().min(1).max(20)).max(200);

export const fraudController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/outbound-policy',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      const policy = await service.getPolicy(user.tenant_id);
      return { data: policy };
    },
  );

  app.put(
    '/outbound-policy',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_MANAGE),
      schema: {
        body: z.object({
          country_allowlist: PrefixListSchema.optional(),
          areacode_allowlist: PrefixListSchema.optional(),
          premium_rate_blocklist: PrefixListSchema.optional(),
          high_risk_blocklist: PrefixListSchema.optional(),
          max_calls_per_hour: z.number().int().positive().nullable().optional(),
          max_calls_per_day: z.number().int().positive().nullable().optional(),
          max_call_duration_secs: z.number().int().positive().nullable().optional(),
          deny_international_default: z.boolean().optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const policy = await service.upsertPolicy(user.tenant_id, req.body);
      return { data: policy };
    },
  );
};
