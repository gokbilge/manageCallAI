/**
 * Registers all named schemas with the OpenAPI registry.
 * Import this module (or import from index.ts which re-exports it)
 * before calling registry.generateDocument() or generateComponents().
 */
import { registry } from '../registry.js';
import * as common from './common.js';
import * as auth from './auth.js';
import * as extensions from './extensions.js';
import * as sipTrunks from './sip-trunks.js';
import * as phoneNumbers from './phone-numbers.js';
import * as prompts from './prompts.js';
import * as callGroups from './call-groups.js';
import * as queues from './queues.js';
import * as voicemailBoxes from './voicemail-boxes.js';
import * as inboundRoutes from './inbound-routes.js';
import * as ivrFlows from './ivr-flows.js';
import * as approvals from './approvals.js';
import * as automation from './automation.js';
import * as callEvents from './call-events.js';
import * as schedules from './schedules.js';
import * as outboundRoutes from './outbound-routes.js';
import * as users from './users.js';
import * as recordings from './recordings.js';
import * as runtime from './runtime.js';
import * as channelAccounts from './channel-accounts.js';
import * as channelMessages from './channel-messages.js';
import * as meetingSessions from './meeting-sessions.js';
import * as providerWork from './provider-work.js';
import * as platform from './platform.js';
import * as responses from './responses.js';

// common
registry.register('ErrorResponse', common.ErrorResponseSchema);

// auth
registry.register('RegisterBody', auth.RegisterBodySchema);
registry.register('LoginBody', auth.LoginBodySchema);
registry.register('AuthTokenResponse', auth.AuthTokenResponseSchema);

// extensions
registry.register('Extension', extensions.ExtensionSchema);
registry.register('CreateExtensionBody', extensions.CreateExtensionBodySchema);
registry.register('UpdateExtensionBody', extensions.UpdateExtensionBodySchema);

// sip-trunks
registry.register('SipTrunk', sipTrunks.SipTrunkSchema);
registry.register('CreateSipTrunkBody', sipTrunks.CreateSipTrunkBodySchema);
registry.register('UpdateSipTrunkBody', sipTrunks.UpdateSipTrunkBodySchema);

// phone-numbers
registry.register('PhoneNumber', phoneNumbers.PhoneNumberSchema);
registry.register('CreatePhoneNumberBody', phoneNumbers.CreatePhoneNumberBodySchema);
registry.register('UpdatePhoneNumberBody', phoneNumbers.UpdatePhoneNumberBodySchema);

// prompts
registry.register('PromptAsset', prompts.PromptAssetSchema);
registry.register('CreatePromptAssetBody', prompts.CreatePromptAssetBodySchema);
registry.register('UpdatePromptAssetBody', prompts.UpdatePromptAssetBodySchema);

// call-groups
registry.register('CallGroupMember', callGroups.CallGroupMemberSchema);
registry.register('CallGroup', callGroups.CallGroupSchema);
registry.register('CallGroupWithMembers', callGroups.CallGroupWithMembersSchema);
registry.register('CreateCallGroupBody', callGroups.CreateCallGroupBodySchema);
registry.register('UpdateCallGroupBody', callGroups.UpdateCallGroupBodySchema);
registry.register('AddCallGroupMemberBody', callGroups.AddCallGroupMemberBodySchema);

// queues
registry.register('QueueMember', queues.QueueMemberSchema);
registry.register('Queue', queues.QueueSchema);
registry.register('QueueWithMembers', queues.QueueWithMembersSchema);
registry.register('CreateQueueBody', queues.CreateQueueBodySchema);
registry.register('UpdateQueueBody', queues.UpdateQueueBodySchema);
registry.register('AddQueueMemberBody', queues.AddQueueMemberBodySchema);

// voicemail-boxes
registry.register('VoicemailBox', voicemailBoxes.VoicemailBoxSchema);
registry.register('CreateVoicemailBoxBody', voicemailBoxes.CreateVoicemailBoxBodySchema);
registry.register('UpdateVoicemailBoxBody', voicemailBoxes.UpdateVoicemailBoxBodySchema);

// inbound-routes
registry.register('RouteVersion', inboundRoutes.RouteVersionSchema);
registry.register('InboundRoute', inboundRoutes.InboundRouteSchema);
registry.register('InboundRouteWithVersions', inboundRoutes.InboundRouteWithVersionsSchema);
registry.register('ValidationError', inboundRoutes.ValidationErrorSchema);
registry.register('ValidationOutcome', inboundRoutes.ValidationOutcomeSchema);
registry.register('CreateInboundRouteBody', inboundRoutes.CreateInboundRouteBodySchema);
registry.register('UpdateInboundRouteBody', inboundRoutes.UpdateInboundRouteBodySchema);

// ivr-flows
registry.register('FlowVersion', ivrFlows.FlowVersionSchema);
registry.register('IvrFlow', ivrFlows.IvrFlowSchema);
registry.register('IvrFlowWithVersions', ivrFlows.IvrFlowWithVersionsSchema);
registry.register('FlowValidationError', ivrFlows.FlowValidationErrorSchema);
registry.register('FlowValidationOutcome', ivrFlows.FlowValidationOutcomeSchema);
registry.register('FlowValidationResult', ivrFlows.FlowValidationResultSchema);
registry.register('SimulationScenario', ivrFlows.SimulationScenarioSchema);
registry.register('SimulationFinalAction', ivrFlows.SimulationFinalActionSchema);
registry.register('SimulationOutcome', ivrFlows.SimulationOutcomeSchema);
registry.register('FlowSimulationResult', ivrFlows.FlowSimulationResultSchema);
registry.register('PublishAttemptResult', ivrFlows.PublishAttemptResultSchema);
registry.register('FlowValidationHistoryEntry', ivrFlows.FlowValidationHistoryEntrySchema);
registry.register('FlowSimulationHistoryEntry', ivrFlows.FlowSimulationHistoryEntrySchema);
registry.register('FlowPublishHistoryEntry', ivrFlows.FlowPublishHistoryEntrySchema);
registry.register('FlowAuditHistoryEntry', ivrFlows.FlowAuditHistoryEntrySchema);
registry.register('FlowHistory', ivrFlows.FlowHistorySchema);
registry.register('CreateIvrFlowBody', ivrFlows.CreateIvrFlowBodySchema);
registry.register('UpdateIvrFlowBody', ivrFlows.UpdateIvrFlowBodySchema);
registry.register('CreateFlowVersionBody', ivrFlows.CreateFlowVersionBodySchema);

// approvals
registry.register('ApprovalRequest', approvals.ApprovalRequestSchema);
registry.register('ApprovalRequestWithDetails', approvals.ApprovalRequestWithDetailsSchema);
registry.register('Policy', approvals.PolicySchema);
registry.register('ApprovalDecisionResult', approvals.ApprovalDecisionResultSchema);
registry.register('ApprovalDecisionBody', approvals.ApprovalDecisionBodySchema);

// automation
registry.register('ApiKey', automation.ApiKeySchema);
registry.register('ApiKeyCreated', automation.ApiKeyCreatedSchema);
registry.register('AutomationWebhook', automation.AutomationWebhookSchema);
registry.register('AutomationWebhookCreated', automation.AutomationWebhookCreatedSchema);
registry.register('WebhookDeliveryAttempt', automation.WebhookDeliveryAttemptSchema);
registry.register('WebhookDeliveryQueueItem', automation.WebhookDeliveryQueueItemSchema);
registry.register('CreateApiKeyBody', automation.CreateApiKeyBodySchema);
registry.register('CreateAutomationWebhookBody', automation.CreateAutomationWebhookBodySchema);

// call-events
registry.register('CallEvent', callEvents.CallEventSchema);
registry.register('IngestCallEventBody', callEvents.IngestCallEventBodySchema);

// schedules
registry.register('WeeklyRule', schedules.WeeklyRuleSchema);
registry.register('HolidayOverride', schedules.HolidayOverrideSchema);
registry.register('Schedule', schedules.ScheduleSchema);
registry.register('CreateScheduleBody', schedules.CreateScheduleBodySchema);
registry.register('UpdateScheduleBody', schedules.UpdateScheduleBodySchema);

// outbound-routes
registry.register('OutboundRoute', outboundRoutes.OutboundRouteSchema);
registry.register('ResolvedOutboundRoute', outboundRoutes.ResolvedOutboundRouteSchema);
registry.register('CreateOutboundRouteBody', outboundRoutes.CreateOutboundRouteBodySchema);
registry.register('UpdateOutboundRouteBody', outboundRoutes.UpdateOutboundRouteBodySchema);
registry.register('ResolveOutboundRouteBody', outboundRoutes.ResolveOutboundRouteBodySchema);

// users
registry.register('TenantUser', users.TenantUserSchema);
registry.register('CreateUserBody', users.CreateUserBodySchema);
registry.register('UpdateUserBody', users.UpdateUserBodySchema);
registry.register('ChangePasswordBody', users.ChangePasswordBodySchema);

// recordings
registry.register('Recording', recordings.RecordingSchema);
registry.register('RecordingAnalysisRequest', recordings.RecordingAnalysisRequestSchema);
registry.register('IngestRecordingBody', recordings.IngestRecordingBodySchema);
registry.register('CreateRecordingAnalysisBody', recordings.CreateRecordingAnalysisBodySchema);
registry.register('CompleteRecordingAnalysisBody', recordings.CompleteRecordingAnalysisBodySchema);

// runtime
registry.register('IvrRuntimeSession', runtime.IvrRuntimeSessionSchema);
registry.register('IvrRuntimeSessionStep', runtime.IvrRuntimeSessionStepSchema);
registry.register('IvrRuntimeSessionResult', runtime.IvrRuntimeSessionResultSchema);
registry.register('OutboundCallRequest', runtime.OutboundCallRequestSchema);
registry.register('StartIvrRuntimeSessionBody', runtime.StartIvrRuntimeSessionBodySchema);
registry.register('AdvanceIvrRuntimeSessionBody', runtime.AdvanceIvrRuntimeSessionBodySchema);
registry.register('CreateOutboundCallBody', runtime.CreateOutboundCallBodySchema);

// channel-accounts
registry.register('ChannelAccount', channelAccounts.ChannelAccountSchema);
registry.register('CreateChannelAccountBody', channelAccounts.CreateChannelAccountBodySchema);
registry.register('UpdateChannelAccountBody', channelAccounts.UpdateChannelAccountBodySchema);

// channel-messages
registry.register('ChannelMessage', channelMessages.ChannelMessageSchema);
registry.register('ChannelMessageRequest', channelMessages.ChannelMessageRequestSchema);
registry.register('IngestInboundMessageBody', channelMessages.IngestInboundMessageBodySchema);
registry.register('CreateOutboundMessageBody', channelMessages.CreateOutboundMessageBodySchema);
registry.register('ClaimOutboundMessageBody', channelMessages.ClaimOutboundMessageBodySchema);
registry.register('CompleteOutboundMessageBody', channelMessages.CompleteOutboundMessageBodySchema);

// meeting-sessions
registry.register('MeetingSession', meetingSessions.MeetingSessionSchema);
registry.register('CreateMeetingSessionBody', meetingSessions.CreateMeetingSessionBodySchema);
registry.register('UpdateMeetingSessionBody', meetingSessions.UpdateMeetingSessionBodySchema);

// provider-work
registry.register('PromptGenerationRequest', providerWork.PromptGenerationRequestSchema);
registry.register('IvrAiTurnRequest', providerWork.IvrAiTurnRequestSchema);
registry.register('CreatePromptGenerationBody', providerWork.CreatePromptGenerationBodySchema);
registry.register('CompletePromptGenerationBody', providerWork.CompletePromptGenerationBodySchema);
registry.register('CreateIvrAiTurnBody', providerWork.CreateIvrAiTurnBodySchema);
registry.register('CompleteIvrAiTurnBody', providerWork.CompleteIvrAiTurnBodySchema);
registry.register('ClaimWorkRequestBody', providerWork.ClaimWorkRequestBodySchema);

// platform
registry.register('TenantSummary', platform.TenantSummarySchema);
registry.register('ServiceHealth', platform.ServiceHealthSchema);
registry.register('RuntimeHealthSummary', platform.RuntimeHealthSummarySchema);
registry.register('PlatformRuntimeSummary', platform.PlatformRuntimeSummarySchema);
registry.register('HealthResponse', platform.HealthResponseSchema);

// responses — data envelope wrappers
registry.register('ExtensionResponse', responses.ExtensionResponseSchema);
registry.register('ExtensionListResponse', responses.ExtensionListResponseSchema);
registry.register('SipTrunkResponse', responses.SipTrunkResponseSchema);
registry.register('SipTrunkListResponse', responses.SipTrunkListResponseSchema);
registry.register('PhoneNumberResponse', responses.PhoneNumberResponseSchema);
registry.register('PhoneNumberListResponse', responses.PhoneNumberListResponseSchema);
registry.register('PromptAssetResponse', responses.PromptAssetResponseSchema);
registry.register('PromptAssetListResponse', responses.PromptAssetListResponseSchema);
registry.register('QueueResponse', responses.QueueResponseSchema);
registry.register('QueueListResponse', responses.QueueListResponseSchema);
registry.register('QueueMemberResponse', responses.QueueMemberResponseSchema);
registry.register('VoicemailBoxResponse', responses.VoicemailBoxResponseSchema);
registry.register('VoicemailBoxListResponse', responses.VoicemailBoxListResponseSchema);
registry.register('InboundRouteResponse', responses.InboundRouteResponseSchema);
registry.register('InboundRouteListResponse', responses.InboundRouteListResponseSchema);
registry.register('RouteVersionResponse', responses.RouteVersionResponseSchema);
registry.register('ValidationResultResponse', responses.ValidationResultResponseSchema);
registry.register('IvrFlowResponse', responses.IvrFlowResponseSchema);
registry.register('IvrFlowDetailResponse', responses.IvrFlowDetailResponseSchema);
registry.register('IvrFlowListResponse', responses.IvrFlowListResponseSchema);
registry.register('FlowVersionResponse', responses.FlowVersionResponseSchema);
registry.register('FlowVersionListResponse', responses.FlowVersionListResponseSchema);
registry.register('IvrFlowValidationResponse', responses.IvrFlowValidationResponseSchema);
registry.register('IvrFlowSimulationResponse', responses.IvrFlowSimulationResponseSchema);
registry.register('IvrFlowPublishResponse', responses.IvrFlowPublishResponseSchema);
registry.register('IvrFlowHistoryResponse', responses.IvrFlowHistoryResponseSchema);
registry.register('IvrRuntimeSessionResponse', responses.IvrRuntimeSessionResponseSchema);
registry.register('IvrRuntimeSessionListResponse', responses.IvrRuntimeSessionListResponseSchema);
registry.register('IvrRuntimeSessionReplayResponse', responses.IvrRuntimeSessionReplayResponseSchema);
registry.register('PromptGenerationRequestResponse', responses.PromptGenerationRequestResponseSchema);
registry.register('PromptGenerationRequestListResponse', responses.PromptGenerationRequestListResponseSchema);
registry.register('IvrAiTurnRequestResponse', responses.IvrAiTurnRequestResponseSchema);
registry.register('CallEventResponse', responses.CallEventResponseSchema);
registry.register('CallEventListResponse', responses.CallEventListResponseSchema);
registry.register('RecordingResponse', responses.RecordingResponseSchema);
registry.register('RecordingListResponse', responses.RecordingListResponseSchema);
registry.register('RecordingAnalysisRequestResponse', responses.RecordingAnalysisRequestResponseSchema);
registry.register('RecordingAnalysisRequestListResponse', responses.RecordingAnalysisRequestListResponseSchema);
registry.register('WebhookDeliveryQueueListResponse', responses.WebhookDeliveryQueueListResponseSchema);
registry.register('ChannelAccountResponse', responses.ChannelAccountResponseSchema);
registry.register('ChannelAccountListResponse', responses.ChannelAccountListResponseSchema);
registry.register('ChannelMessageResponse', responses.ChannelMessageResponseSchema);
registry.register('ChannelMessageRequestResponse', responses.ChannelMessageRequestResponseSchema);
registry.register('ChannelMessageRequestListResponse', responses.ChannelMessageRequestListResponseSchema);
registry.register('ChannelVoiceSessionResponse', responses.ChannelVoiceSessionResponseSchema);
registry.register('TenantListResponse', responses.TenantListResponseSchema);
registry.register('RuntimeHealthResponse', responses.RuntimeHealthResponseSchema);
registry.register('PlatformRuntimeSummaryResponse', responses.PlatformRuntimeSummaryResponseSchema);
registry.register('RouteLookupResponse', responses.RouteLookupResponseSchema);
