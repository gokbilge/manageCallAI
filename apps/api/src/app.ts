import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import type { FastifyJWTOptions } from '@fastify/jwt';
import Fastify, { type FastifyInstance, type FastifyPluginCallback } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config } from './config/env.js';
import { healthController } from './health/health.controller.js';
import { metricsController } from './health/metrics.controller.js';
import { supportController } from './health/support.controller.js';
import { authController } from './modules/auth/auth.controller.js';
import { callEventController } from './modules/call-events/call-event.controller.js';
import { extensionController } from './modules/extensions/extension.controller.js';
import { extensionEventController } from './modules/extensions/extension-event.controller.js';
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
import { voicemailMessageController } from './modules/voicemail-boxes/voicemail-message.controller.js';
import { auditController } from './modules/audit/audit.controller.js';
import { recordingAnalysisController, recordingController } from './modules/recordings/recording.controller.js';
import { exportController } from './modules/export/export.controller.js';
import { userController } from './modules/users/user.controller.js';
import { ivrAiController, promptGenerationController } from './modules/provider-work/provider-work.controller.js';
import { channelAccountController } from './modules/channel-accounts/channel-account.controller.js';
import { channelMessageController } from './modules/channel-messages/channel-message.controller.js';
import { meetingSessionController } from './modules/meeting-sessions/meeting-session.controller.js';
import { observabilityController } from './modules/observability/observability.controller.js';
import { fraudController } from './modules/fraud/fraud.controller.js';
import { retentionController } from './modules/retention/retention.controller.js';
import { nodeRegistryController } from './modules/runtime/node-registry.controller.js';
import { registerErrorHandler } from './errors/index.js';
import { redactSensitiveUrl, registerLoggingHooks } from './logging/logger.js';
import { idempotencyPlugin } from './modules/idempotency/idempotency.plugin.js';
import { registerRateLimitHook } from './security/rate-limit.js';

// ── Module group registration ─────────────────────────────────────────────────

/**
 * Core tenant domain: extensions, trunks, phone numbers, prompts, IVR flows,
 * call groups, queues, voicemail boxes, inbound/outbound routes, approvals, schedules.
 */
function registerCoreDomainModules(app: FastifyInstance): void {
  app.register(extensionController, { prefix: '/api/v1/extensions' });
  app.register(sipTrunkController, { prefix: '/api/v1/sip-trunks' });
  app.register(phoneNumberController, { prefix: '/api/v1/phone-numbers' });
  app.register(promptAssetController, { prefix: '/api/v1/prompts' });
  app.register(ivrFlowController, { prefix: '/api/v1/ivr-flows' });
  app.register(callGroupController, { prefix: '/api/v1/call-groups' });
  app.register(queueController, { prefix: '/api/v1/queues' });
  app.register(voicemailBoxController, { prefix: '/api/v1/voicemail-boxes' });
  app.register(voicemailMessageController, { prefix: '/api/v1/voicemail-boxes' });
  app.register(inboundRouteController, { prefix: '/api/v1/inbound-routes' });
  app.register(outboundRouteController, { prefix: '/api/v1/outbound-routes' });
  app.register(approvalController, { prefix: '/api/v1/approvals' });
  app.register(policiesController, { prefix: '/api/v1/policies' });
  app.register(scheduleController, { prefix: '/api/v1/schedules' });
}

/**
 * Runtime / operational: call events, IVR runtime sessions, outbound call dispatch,
 * recordings, provider AI work, FreeSWITCH mod_xml_curl callbacks.
 */
function registerRuntimeModules(app: FastifyInstance): void {
  app.register(callEventController, { prefix: '/api/v1/call-events' });
  app.register(ivrRuntimeController, { prefix: '/api/v1/runtime/ivr' });
  app.register(outboundCallController, { prefix: '/api/v1/runtime' });
  app.register(extensionEventController, { prefix: '/api/v1/runtime' });
  app.register(recordingController, { prefix: '/api/v1/recordings' });
  app.register(recordingAnalysisController, { prefix: '/api/v1/recording-analysis' });
  app.register(promptGenerationController, { prefix: '/api/v1/prompt-generation' });
  app.register(ivrAiController, { prefix: '/api/v1' });
  app.register(freeswitchController, { prefix: '/api/v1/freeswitch' });
}

/**
 * Integration / automation: webhook automation, channel accounts, channel messages,
 * meeting sessions, data export.
 */
function registerIntegrationModules(app: FastifyInstance): void {
  app.register(automationController, { prefix: '/api/v1/automation' });
  app.register(webhooksController, { prefix: '/api/v1/webhooks' });
  app.register(channelAccountController, { prefix: '/api/v1/channel-accounts' });
  app.register(channelAccountController, { prefix: '/api/v1/channels/accounts' });
  app.register(channelMessageController, { prefix: '/api/v1/channel' });
  app.register(channelMessageController, { prefix: '/api/v1/channels' });
  app.register(meetingSessionController, { prefix: '/api/v1/meeting-sessions' });
  app.register(meetingSessionController, { prefix: '/api/v1/channels/voice-sessions' });
  app.register(exportController, { prefix: '/api/v1/export' });
}

/**
 * Observability: live tenant snapshot and SSE stream for the operations cockpit.
 */
function registerObservabilityModules(app: FastifyInstance): void {
  app.register(observabilityController, { prefix: '/api/v1/observability' });
}

/**
 * Platform / cross-cutting: platform management, tenant audit log, user management,
 * auth.
 */
function registerPlatformModules(app: FastifyInstance): void {
  app.register(authController, { prefix: '/api/v1/auth' });
  app.register(platformController, { prefix: '/api/v1/platform' });
  app.register(nodeRegistryController, { prefix: '/api/v1/platform' });
  app.register(auditController, { prefix: '/api/v1/audit' });
  app.register(userController, { prefix: '/api/v1/users' });
  app.register(fraudController, { prefix: '/api/v1/fraud' });
  app.register(retentionController, { prefix: '/api/v1/tenant' });
}

// ── App factory ───────────────────────────────────────────────────────────────

export function buildApp() {
  const app = Fastify({
    logger: {
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        "req.headers['x-managecallai-runtime-token']",
        'headers.authorization',
        'headers.cookie',
        "headers['x-managecallai-runtime-token']",
      ],
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: redactSensitiveUrl(req.url),
            host: req.hostname,
            remoteAddress: req.ip,
            remotePort: req.socket.remotePort,
          };
        },
      },
    },
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const jwtPlugin = jwt as unknown as FastifyPluginCallback<FastifyJWTOptions>;

  registerErrorHandler(app);
  registerLoggingHooks(app);
  registerRateLimitHook(app);

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
  app.register(metricsController, { prefix: '/metrics' });
  app.register(supportController, { prefix: '/api/v1/support' });

  // Idempotency plugin: applies to all POST/PATCH routes that carry Idempotency-Key.
  app.register(idempotencyPlugin);

  registerCoreDomainModules(app);
  registerRuntimeModules(app);
  registerIntegrationModules(app);
  registerObservabilityModules(app);
  registerPlatformModules(app);

  return app;
}
