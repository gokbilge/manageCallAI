import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import { authenticatePlatform } from './authenticate-platform.js';
import { PlatformRepository } from './platform.repository.js';
import { PlatformService } from './platform.service.js';

const service = new PlatformService(new PlatformRepository(db));

export const platformController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticatePlatform);

  app.get('/tenants', async () => {
    const tenants = await service.listTenants();
    return { data: tenants };
  });

  app.get('/runtime/health', async () => {
    const health = await service.runtimeHealth();
    return { data: health };
  });

  app.get('/runtime/summary', async () => {
    const summary = await service.runtimeSummary();
    return { data: summary };
  });
};
