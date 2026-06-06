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
import { carrierAssistantController } from './modules/sip-trunks/carrier-assistant.controller.js';
import { runtimeApplyController } from './modules/sip-trunks/runtime-apply.controller.js';
import { featureCodeController } from './modules/feature-codes/feature-code.controller.js';
import { parkingLotController, parkingRuntimeController } from './modules/parking/parking-lot.controller.js';
import { conferenceRoomController, conferenceRuntimeController } from './modules/conference-rooms/conference-room.controller.js';
import { scheduleController } from './modules/schedules/schedule.controller.js';
import { outboundRouteController } from './modules/outbound-routes/outbound-route.controller.js';
import { voicemailBoxController } from './modules/voicemail-boxes/voicemail-box.controller.js';
import { voicemailMessageController } from './modules/voicemail-boxes/voicemail-message.controller.js';
import { auditController } from './modules/audit/audit.controller.js';
import { recordingAnalysisController, recordingController } from './modules/recordings/recording.controller.js';
import { recordingSearchController } from './modules/recordings/recording-search.controller.js';
import { exportController } from './modules/export/export.controller.js';
import { userController } from './modules/users/user.controller.js';
import { ivrAiController, promptGenerationController, ivrGenerationWorkerController, ivrAiPatchWorkerController } from './modules/provider-work/provider-work.controller.js';
import { ivrGenerationController, ivrAiPatchController, inboundRouteAiPatchController } from './modules/ivr-flows/ivr-ai-generation.controller.js';
import { channelAccountController } from './modules/channel-accounts/channel-account.controller.js';
import { channelMessageController } from './modules/channel-messages/channel-message.controller.js';
import { meetingSessionController } from './modules/meeting-sessions/meeting-session.controller.js';
import { observabilityController } from './modules/observability/observability.controller.js';
import { fraudController } from './modules/fraud/fraud.controller.js';
import { retentionController } from './modules/retention/retention.controller.js';
import { nodeRegistryController } from './modules/runtime/node-registry.controller.js';
import { nodeStatusController, tenantGatewayStatusController } from './modules/runtime/node-status.controller.js';
import { selfServiceMeController, selfServicePolicyController } from './modules/self-service/self-service.controller.js';
import { riskAnalysisController } from './modules/risk-analysis/risk-analysis.controller.js';
import { numberingPlanController } from './modules/numbering-plans/numbering-plan.controller.js';
import { callingPolicyController } from './modules/calling-policies/calling-policy.controller.js';
import { siteController } from './modules/sites/site.controller.js';
import { trunkGroupController, routeListController, carrierResolutionController } from './modules/trunk-groups/trunk-group.controller.js';
import { deviceController, extensionAssignmentController, deviceRegistrationController } from './modules/devices/device.controller.js';
import { lineAppearanceController, deviceAppearanceController } from './modules/line-appearances/line-appearance.controller.js';
import { reportingController } from './modules/reporting/reporting.controller.js';
import { callFailureExplanationController } from './modules/call-failure-explanation/call-failure-explanation.controller.js';
import { platformAiPolicyController, tenantAiPolicyController } from './modules/ai-policy/ai-policy.controller.js';
import { aiRecommendationsController } from './modules/ai-recommendations/ai-recommendations.controller.js';
import { incidentInvestigationController } from './modules/incident-investigation/incident-investigation.controller.js';
import { agentProfileController, agentWorkspaceMeController, queueAgentAvailabilityController } from './modules/agent-workspace/agent-workspace.controller.js';
import { skillController, agentProfileSkillController, queueSkillController } from './modules/skills/skills.controller.js';
import { crmIntegrationController } from './modules/crm-integrations/crm-integrations.controller.js';
import { campaignController } from './modules/campaigns/campaigns.controller.js';
import { supervisorControlsController } from './modules/supervisor-controls/supervisor-controls.controller.js';
import { queueCallbackController, queueScopedCallbackController } from './modules/queue-callbacks/queue-callbacks.controller.js';
import { supervisorDashboardController } from './modules/supervisor-dashboard/supervisor-dashboard.controller.js';
import { setupController } from './modules/setup/setup.controller.js';
import { db } from './db/client.js';
import { registerErrorHandler } from './errors/index.js';
import { redactSensitiveUrl, registerLoggingHooks } from './logging/logger.js';
import { idempotencyPlugin } from './modules/idempotency/idempotency.plugin.js';
import { registerRateLimitHook } from './security/rate-limit.js';
import {
  getHeadlessBootstrapVarsFromEnv,
  isSetupComplete,
  runHeadlessBootstrap,
} from './modules/setup/setup.service.js';

// ── Module group registration ─────────────────────────────────────────────────

/**
 * Core tenant domain: extensions, trunks, phone numbers, prompts, IVR flows,
 * call groups, queues, voicemail boxes, inbound/outbound routes, approvals, schedules.
 */
function registerCoreDomainModules(app: FastifyInstance): void {
  app.register(extensionController, { prefix: '/api/v1/extensions' });
  app.register(sipTrunkController, { prefix: '/api/v1/sip-trunks' });
  app.register(carrierAssistantController, { prefix: '/api/v1/sip-trunks' });
  app.register(featureCodeController, { prefix: '/api/v1/feature-codes' });
  app.register(parkingLotController, { prefix: '/api/v1/parking-lots' });
  app.register(conferenceRoomController, { prefix: '/api/v1/conference-rooms' });
  // End-user self-service: /me/* endpoints.
  app.register(selfServiceMeController, { prefix: '/api/v1/me' });
  app.register(phoneNumberController, { prefix: '/api/v1/phone-numbers' });
  app.register(promptAssetController, { prefix: '/api/v1/prompts' });
  app.register(ivrFlowController, { prefix: '/api/v1/ivr-flows' });
  app.register(ivrAiPatchController, { prefix: '/api/v1/ivr-flows' });
  app.register(callGroupController, { prefix: '/api/v1/call-groups' });
  app.register(queueController, { prefix: '/api/v1/queues' });
  app.register(voicemailBoxController, { prefix: '/api/v1/voicemail-boxes' });
  app.register(voicemailMessageController, { prefix: '/api/v1/voicemail-boxes' });
  app.register(inboundRouteController, { prefix: '/api/v1/inbound-routes' });
  app.register(inboundRouteAiPatchController, { prefix: '/api/v1/inbound-routes' });
  app.register(outboundRouteController, { prefix: '/api/v1/outbound-routes' });
  app.register(riskAnalysisController, { prefix: '/api/v1/risk-analysis' });
  app.register(numberingPlanController, { prefix: '/api/v1/numbering-plans' });
  app.register(callingPolicyController, { prefix: '/api/v1/calling-policies' });
  app.register(siteController, { prefix: '/api/v1/sites' });
  app.register(trunkGroupController, { prefix: '/api/v1/trunk-groups' });
  app.register(routeListController, { prefix: '/api/v1/route-lists' });
  app.register(carrierResolutionController, { prefix: '/api/v1/outbound-routing' });
  app.register(deviceController, { prefix: '/api/v1/devices' });
  app.register(deviceAppearanceController, { prefix: '/api/v1/devices' });
  app.register(extensionAssignmentController, { prefix: '/api/v1/extensions' });
  app.register(lineAppearanceController, { prefix: '/api/v1/line-appearances' });
  app.register(aiRecommendationsController, { prefix: '/api/v1/ai-recommendations' });
  app.register(incidentInvestigationController, { prefix: '/api/v1/incidents/investigate' });
  app.register(reportingController, { prefix: '/api/v1/reporting' });
  app.register(callFailureExplanationController, { prefix: '/api/v1/calls' });
  app.register(approvalController, { prefix: '/api/v1/approvals' });
  app.register(policiesController, { prefix: '/api/v1/policies' });
  app.register(scheduleController, { prefix: '/api/v1/schedules' });
  // Contact-center: agent workspace (#271), availability (#272), skills-based routing (#273)
  app.register(agentProfileController, { prefix: '/api/v1/agent-profiles' });
  app.register(agentProfileSkillController, { prefix: '/api/v1/agent-profiles' });
  app.register(agentWorkspaceMeController, { prefix: '/api/v1/me/agent-workspace' });
  app.register(queueAgentAvailabilityController, { prefix: '/api/v1/queues' });
  app.register(skillController, { prefix: '/api/v1/skills' });
  app.register(queueSkillController, { prefix: '/api/v1/queues' });
  // Contact-center: CRM screen-pop (#281), campaign management (#282)
  app.register(crmIntegrationController, { prefix: '/api/v1/crm-integrations' });
  app.register(campaignController, { prefix: '/api/v1/campaigns' });
  // Contact-center: supervisor dashboard (#274,#277), monitor/whisper/barge (#275), queue callbacks (#276)
  app.register(supervisorDashboardController, { prefix: '/api/v1/supervisor' });
  app.register(supervisorControlsController, { prefix: '/api/v1/supervisor/controls' });
  app.register(queueCallbackController, { prefix: '/api/v1/queue-callbacks' });
  app.register(queueScopedCallbackController, { prefix: '/api/v1/queues' });
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
  app.register(recordingSearchController, { prefix: '/api/v1/recordings' });
  app.register(recordingAnalysisController, { prefix: '/api/v1/recording-analysis' });
  app.register(promptGenerationController, { prefix: '/api/v1/prompt-generation' });
  app.register(ivrGenerationController, { prefix: '/api/v1/ivr-generation' });
  app.register(ivrAiController, { prefix: '/api/v1' });
  app.register(ivrGenerationWorkerController, { prefix: '/api/v1' });
  app.register(ivrAiPatchWorkerController, { prefix: '/api/v1' });
  app.register(freeswitchController, { prefix: '/api/v1/freeswitch' });
  // Gateway reload / runtime apply: tenant endpoints + Go agent runtime callbacks.
  app.register(runtimeApplyController, { prefix: '/api/v1' });
  // Device registration callbacks (Go agent / FreeSWITCH HMAC).
  app.register(deviceRegistrationController, { prefix: '/api/v1' });
  // Parking and conference runtime callbacks (Go agent HMAC).
  app.register(parkingRuntimeController, { prefix: '/api/v1/runtime' });
  app.register(conferenceRuntimeController, { prefix: '/api/v1/runtime' });
  // Tenant gateway status (tenant admin — own gateways).
  app.register(tenantGatewayStatusController, { prefix: '/api/v1/runtime' });
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
  app.register(platformAiPolicyController, { prefix: '/api/v1/platform' });
  app.register(nodeRegistryController, { prefix: '/api/v1/platform' });
  // Node status: platform admin reads + Go agent push (prefix /api/v1/platform for reads)
  app.register(nodeStatusController, { prefix: '/api/v1/platform' });
  app.register(auditController, { prefix: '/api/v1/audit' });
  app.register(userController, { prefix: '/api/v1/users' });
  app.register(fraudController, { prefix: '/api/v1/fraud' });
  app.register(retentionController, { prefix: '/api/v1/tenant' });
  app.register(selfServicePolicyController, { prefix: '/api/v1/tenant' });
  app.register(tenantAiPolicyController, { prefix: '/api/v1/tenant' });
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

export async function runBootstrapIfNeeded(app: FastifyInstance): Promise<void> {
  if (await isSetupComplete(db)) {
    return;
  }

  const headlessVars = getHeadlessBootstrapVarsFromEnv();
  if (headlessVars) {
    if (!config.platformOperatorEmails.includes(headlessVars.adminEmail.toLowerCase())) {
      throw new Error(
        'SETUP_ADMIN_EMAIL must be included in PLATFORM_OPERATOR_EMAILS before headless bootstrap runs',
      );
    }
    const result = await runHeadlessBootstrap(db, headlessVars);
    if (result) {
      app.log.info(
        { adminEmail: result.adminEmail, tenantSlug: result.tenantSlug },
        'manageCallAI setup complete',
      );
    }
    return;
  }

  await app.register(setupController, { prefix: '/setup' });
}
