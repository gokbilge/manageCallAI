import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import type { FastifyJWTOptions } from '@fastify/jwt';
import Fastify, { type FastifyPluginCallback } from 'fastify';
import { config } from './config/env.js';
import { healthController } from './health/health.controller.js';
import { authController } from './modules/auth/auth.controller.js';
import { callEventController } from './modules/call-events/call-event.controller.js';
import { extensionController } from './modules/extensions/extension.controller.js';
import { freeswitchController } from './modules/freeswitch/freeswitch.controller.js';
import { inboundRouteController } from './modules/inbound-routes/inbound-route.controller.js';
import { approvalController, policiesController } from './modules/approvals/approval.controller.js';
import { automationController } from './modules/automation/automation.controller.js';
import { webhooksController } from './modules/webhooks/webhooks.controller.js';
import { callGroupController } from './modules/call-groups/call-group.controller.js';
import { queueController } from './modules/queues/queue.controller.js';
import { ivrFlowController } from './modules/ivr-flows/ivr-flow.controller.js';
import { platformController } from './modules/platform/platform.controller.js';
import { phoneNumberController } from './modules/phone-numbers/phone-number.controller.js';
import { promptAssetController } from './modules/prompts/prompt-asset.controller.js';
import { ivrRuntimeController } from './modules/runtime/ivr-runtime.controller.js';
import { outboundCallController } from './modules/runtime/outbound-call.controller.js';
import { sipTrunkController } from './modules/sip-trunks/sip-trunk.controller.js';
import { scheduleController } from './modules/schedules/schedule.controller.js';
import { outboundRouteController } from './modules/outbound-routes/outbound-route.controller.js';
import { voicemailBoxController } from './modules/voicemail-boxes/voicemail-box.controller.js';
import { auditController } from './modules/audit/audit.controller.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  const jwtPlugin = jwt as unknown as FastifyPluginCallback<FastifyJWTOptions>;

  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });
  app.register(formbody);
  // Type assertion required: @fastify/jwt wraps itself in fastify-plugin whose
  // inferred type doesn't flow correctly under NodeNext resolution.
  app.register(jwtPlugin, {
    secret: config.jwtSecret,
    sign: { expiresIn: '24h' },
  });

  app.register(healthController, { prefix: '/health' });
  app.register(authController, { prefix: '/api/v1/auth' });
  app.register(extensionController, { prefix: '/api/v1/extensions' });
  app.register(sipTrunkController, { prefix: '/api/v1/sip-trunks' });
  app.register(phoneNumberController, { prefix: '/api/v1/phone-numbers' });
  app.register(promptAssetController, { prefix: '/api/v1/prompts' });
  app.register(callEventController, { prefix: '/api/v1/call-events' });
  app.register(freeswitchController, { prefix: '/api/v1/freeswitch' });
  app.register(ivrRuntimeController, { prefix: '/api/v1/runtime/ivr' });
  app.register(outboundCallController, { prefix: '/api/v1/runtime' });
  app.register(ivrFlowController, { prefix: '/api/v1/ivr-flows' });
  app.register(approvalController, { prefix: '/api/v1/approvals' });
  app.register(callGroupController, { prefix: '/api/v1/call-groups' });
  app.register(queueController, { prefix: '/api/v1/queues' });
  app.register(voicemailBoxController, { prefix: '/api/v1/voicemail-boxes' });
  app.register(policiesController, { prefix: '/api/v1/policies' });
  app.register(inboundRouteController, { prefix: '/api/v1/inbound-routes' });
  app.register(platformController, { prefix: '/api/v1/platform' });
  app.register(automationController, { prefix: '/api/v1/automation' });
  app.register(webhooksController, { prefix: '/api/v1/webhooks' });
  app.register(scheduleController, { prefix: '/api/v1/schedules' });
  app.register(outboundRouteController, { prefix: '/api/v1/outbound-routes' });
  app.register(auditController, { prefix: '/api/v1/audit' });

  return app;
}
