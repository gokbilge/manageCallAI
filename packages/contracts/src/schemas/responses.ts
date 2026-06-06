import { z } from '../registry.js';
import { ExtensionSchema } from './extensions.js';
import { SipTrunkSchema } from './sip-trunks.js';
import { PhoneNumberSchema } from './phone-numbers.js';
import { PromptAssetSchema } from './prompts.js';
import { QueueSchema, QueueMemberSchema, QueueWithMembersSchema } from './queues.js';
import { VoicemailBoxSchema } from './voicemail-boxes.js';
import {
  RouteVersionSchema,
  InboundRouteSchema,
  InboundRouteWithVersionsSchema,
  ValidationOutcomeSchema,
} from './inbound-routes.js';
import {
  FlowVersionSchema,
  IvrFlowSchema,
  IvrFlowWithVersionsSchema,
  FlowValidationResultSchema,
  FlowSimulationResultSchema,
  PublishAttemptResultSchema,
  FlowHistorySchema,
} from './ivr-flows.js';
import { IvrRuntimeSessionSchema, IvrRuntimeSessionResultSchema } from './runtime.js';
import { PromptGenerationRequestSchema, IvrAiTurnRequestSchema } from './provider-work.js';
import { CallEventSchema } from './call-events.js';
import { RecordingSchema, RecordingAnalysisRequestSchema } from './recordings.js';
import { IncidentInvestigationSchema } from './incident-investigation.js';
import { WebhookDeliveryQueueItemSchema } from './automation.js';
import { ChannelAccountSchema } from './channel-accounts.js';
import { ChannelMessageSchema, ChannelMessageRequestSchema } from './channel-messages.js';
import { MeetingSessionSchema } from './meeting-sessions.js';
import { TenantSummarySchema, RuntimeHealthSummarySchema, PlatformRuntimeSummarySchema } from './platform.js';
import { CarrierAssistantSuggestionSchema } from './carrier-assistant.js';

// ── Extensions ────────────────────────────────────────────────────────────────
export const ExtensionResponseSchema = z.object({ data: ExtensionSchema }).openapi('ExtensionResponse');
export type ExtensionResponse = z.infer<typeof ExtensionResponseSchema>;
export const ExtensionListResponseSchema = z.object({ data: z.array(ExtensionSchema) }).openapi('ExtensionListResponse');
export type ExtensionListResponse = z.infer<typeof ExtensionListResponseSchema>;

// ── SIP Trunks ────────────────────────────────────────────────────────────────
export const SipTrunkResponseSchema = z.object({ data: SipTrunkSchema }).openapi('SipTrunkResponse');
export type SipTrunkResponse = z.infer<typeof SipTrunkResponseSchema>;
export const SipTrunkListResponseSchema = z.object({ data: z.array(SipTrunkSchema) }).openapi('SipTrunkListResponse');
export type SipTrunkListResponse = z.infer<typeof SipTrunkListResponseSchema>;

// ── Phone Numbers ─────────────────────────────────────────────────────────────
export const PhoneNumberResponseSchema = z.object({ data: PhoneNumberSchema }).openapi('PhoneNumberResponse');
export type PhoneNumberResponse = z.infer<typeof PhoneNumberResponseSchema>;
export const PhoneNumberListResponseSchema = z.object({ data: z.array(PhoneNumberSchema) }).openapi('PhoneNumberListResponse');
export type PhoneNumberListResponse = z.infer<typeof PhoneNumberListResponseSchema>;

// ── Prompt Assets ─────────────────────────────────────────────────────────────
export const PromptAssetResponseSchema = z.object({ data: PromptAssetSchema }).openapi('PromptAssetResponse');
export type PromptAssetResponse = z.infer<typeof PromptAssetResponseSchema>;
export const PromptAssetListResponseSchema = z.object({ data: z.array(PromptAssetSchema) }).openapi('PromptAssetListResponse');
export type PromptAssetListResponse = z.infer<typeof PromptAssetListResponseSchema>;

// ── Queues ────────────────────────────────────────────────────────────────────
export const QueueResponseSchema = z.object({ data: QueueWithMembersSchema }).openapi('QueueResponse');
export type QueueResponse = z.infer<typeof QueueResponseSchema>;
export const QueueListResponseSchema = z.object({ data: z.array(QueueSchema) }).openapi('QueueListResponse');
export type QueueListResponse = z.infer<typeof QueueListResponseSchema>;
export const QueueMemberResponseSchema = z.object({ data: QueueMemberSchema }).openapi('QueueMemberResponse');
export type QueueMemberResponse = z.infer<typeof QueueMemberResponseSchema>;

// ── Voicemail Boxes ───────────────────────────────────────────────────────────
export const VoicemailBoxResponseSchema = z.object({ data: VoicemailBoxSchema }).openapi('VoicemailBoxResponse');
export type VoicemailBoxResponse = z.infer<typeof VoicemailBoxResponseSchema>;
export const VoicemailBoxListResponseSchema = z.object({ data: z.array(VoicemailBoxSchema) }).openapi('VoicemailBoxListResponse');
export type VoicemailBoxListResponse = z.infer<typeof VoicemailBoxListResponseSchema>;

// ── Inbound Routes ────────────────────────────────────────────────────────────
export const InboundRouteResponseSchema = z.object({ data: InboundRouteWithVersionsSchema }).openapi('InboundRouteResponse');
export type InboundRouteResponse = z.infer<typeof InboundRouteResponseSchema>;
export const InboundRouteListResponseSchema = z.object({ data: z.array(InboundRouteSchema) }).openapi('InboundRouteListResponse');
export type InboundRouteListResponse = z.infer<typeof InboundRouteListResponseSchema>;
export const RouteVersionResponseSchema = z.object({ data: RouteVersionSchema }).openapi('RouteVersionResponse');
export type RouteVersionResponse = z.infer<typeof RouteVersionResponseSchema>;
export const ValidationResultResponseSchema = z.object({ data: ValidationOutcomeSchema }).openapi('ValidationResultResponse');
export type ValidationResultResponse = z.infer<typeof ValidationResultResponseSchema>;

// ── IVR Flows ─────────────────────────────────────────────────────────────────
export const IvrFlowResponseSchema = z.object({ data: IvrFlowSchema }).openapi('IvrFlowResponse');
export type IvrFlowResponse = z.infer<typeof IvrFlowResponseSchema>;
export const IvrFlowDetailResponseSchema = z.object({ data: IvrFlowWithVersionsSchema }).openapi('IvrFlowDetailResponse');
export type IvrFlowDetailResponse = z.infer<typeof IvrFlowDetailResponseSchema>;
export const IvrFlowListResponseSchema = z.object({ data: z.array(IvrFlowSchema) }).openapi('IvrFlowListResponse');
export type IvrFlowListResponse = z.infer<typeof IvrFlowListResponseSchema>;
export const FlowVersionResponseSchema = z.object({ data: FlowVersionSchema }).openapi('FlowVersionResponse');
export type FlowVersionResponse = z.infer<typeof FlowVersionResponseSchema>;
export const FlowVersionListResponseSchema = z.object({ data: z.array(FlowVersionSchema) }).openapi('FlowVersionListResponse');
export type FlowVersionListResponse = z.infer<typeof FlowVersionListResponseSchema>;
export const IvrFlowValidationResponseSchema = z.object({ data: FlowValidationResultSchema }).openapi('IvrFlowValidationResponse');
export type IvrFlowValidationResponse = z.infer<typeof IvrFlowValidationResponseSchema>;
export const IvrFlowSimulationResponseSchema = z.object({ data: FlowSimulationResultSchema }).openapi('IvrFlowSimulationResponse');
export type IvrFlowSimulationResponse = z.infer<typeof IvrFlowSimulationResponseSchema>;
export const IvrFlowPublishResponseSchema = z.object({ data: PublishAttemptResultSchema }).openapi('IvrFlowPublishResponse');
export type IvrFlowPublishResponse = z.infer<typeof IvrFlowPublishResponseSchema>;
export const IvrFlowHistoryResponseSchema = z.object({ data: FlowHistorySchema }).openapi('IvrFlowHistoryResponse');
export type IvrFlowHistoryResponse = z.infer<typeof IvrFlowHistoryResponseSchema>;

// ── IVR Runtime ───────────────────────────────────────────────────────────────
export const IvrRuntimeSessionResponseSchema = z.object({ data: IvrRuntimeSessionResultSchema }).openapi('IvrRuntimeSessionResponse');
export type IvrRuntimeSessionResponse = z.infer<typeof IvrRuntimeSessionResponseSchema>;
export const IvrRuntimeSessionListResponseSchema = z.object({ data: z.array(IvrRuntimeSessionSchema) }).openapi('IvrRuntimeSessionListResponse');
export type IvrRuntimeSessionListResponse = z.infer<typeof IvrRuntimeSessionListResponseSchema>;
export const IvrRuntimeSessionReplayResponseSchema = z.object({ data: IvrRuntimeSessionResultSchema }).openapi('IvrRuntimeSessionReplayResponse');
export type IvrRuntimeSessionReplayResponse = z.infer<typeof IvrRuntimeSessionReplayResponseSchema>;

// ── Provider Work ─────────────────────────────────────────────────────────────
export const PromptGenerationRequestResponseSchema = z.object({ data: PromptGenerationRequestSchema }).openapi('PromptGenerationRequestResponse');
export type PromptGenerationRequestResponse = z.infer<typeof PromptGenerationRequestResponseSchema>;
export const PromptGenerationRequestListResponseSchema = z.object({ data: z.array(PromptGenerationRequestSchema) }).openapi('PromptGenerationRequestListResponse');
export type PromptGenerationRequestListResponse = z.infer<typeof PromptGenerationRequestListResponseSchema>;
export const IvrAiTurnRequestResponseSchema = z.object({ data: IvrAiTurnRequestSchema }).openapi('IvrAiTurnRequestResponse');
export type IvrAiTurnRequestResponse = z.infer<typeof IvrAiTurnRequestResponseSchema>;

// ── Call Events ───────────────────────────────────────────────────────────────
export const CallEventResponseSchema = z.object({ data: CallEventSchema }).openapi('CallEventResponse');
export type CallEventResponse = z.infer<typeof CallEventResponseSchema>;
export const CallEventListResponseSchema = z.object({ data: z.array(CallEventSchema) }).openapi('CallEventListResponse');
export type CallEventListResponse = z.infer<typeof CallEventListResponseSchema>;

// ── Recordings ────────────────────────────────────────────────────────────────
export const RecordingResponseSchema = z.object({ data: RecordingSchema }).openapi('RecordingResponse');
export type RecordingResponse = z.infer<typeof RecordingResponseSchema>;
export const RecordingListResponseSchema = z.object({ data: z.array(RecordingSchema) }).openapi('RecordingListResponse');
export type RecordingListResponse = z.infer<typeof RecordingListResponseSchema>;
export const RecordingAnalysisRequestResponseSchema = z.object({ data: RecordingAnalysisRequestSchema }).openapi('RecordingAnalysisRequestResponse');
export type RecordingAnalysisRequestResponse = z.infer<typeof RecordingAnalysisRequestResponseSchema>;
export const RecordingAnalysisRequestListResponseSchema = z.object({ data: z.array(RecordingAnalysisRequestSchema) }).openapi('RecordingAnalysisRequestListResponse');
export type RecordingAnalysisRequestListResponse = z.infer<typeof RecordingAnalysisRequestListResponseSchema>;
export const IncidentInvestigationResponseSchema = z.object({ data: IncidentInvestigationSchema }).openapi('IncidentInvestigationResponse');
export type IncidentInvestigationResponse = z.infer<typeof IncidentInvestigationResponseSchema>;
export const IncidentInvestigationListResponseSchema = z.object({ data: z.array(IncidentInvestigationSchema) }).openapi('IncidentInvestigationListResponse');
export type IncidentInvestigationListResponse = z.infer<typeof IncidentInvestigationListResponseSchema>;
export const CarrierAssistantSuggestionResponseSchema = z.object({ data: CarrierAssistantSuggestionSchema }).openapi('CarrierAssistantSuggestionResponse');
export type CarrierAssistantSuggestionResponse = z.infer<typeof CarrierAssistantSuggestionResponseSchema>;

// ── Automation / Webhooks ─────────────────────────────────────────────────────
export const WebhookDeliveryQueueListResponseSchema = z.object({ data: z.array(WebhookDeliveryQueueItemSchema) }).openapi('WebhookDeliveryQueueListResponse');
export type WebhookDeliveryQueueListResponse = z.infer<typeof WebhookDeliveryQueueListResponseSchema>;

// ── Channel Accounts ──────────────────────────────────────────────────────────
export const ChannelAccountResponseSchema = z.object({ data: ChannelAccountSchema }).openapi('ChannelAccountResponse');
export type ChannelAccountResponse = z.infer<typeof ChannelAccountResponseSchema>;
export const ChannelAccountListResponseSchema = z.object({ data: z.array(ChannelAccountSchema) }).openapi('ChannelAccountListResponse');
export type ChannelAccountListResponse = z.infer<typeof ChannelAccountListResponseSchema>;

// ── Channel Messages ──────────────────────────────────────────────────────────
export const ChannelMessageResponseSchema = z.object({ data: ChannelMessageSchema }).openapi('ChannelMessageResponse');
export type ChannelMessageResponse = z.infer<typeof ChannelMessageResponseSchema>;
export const ChannelMessageRequestResponseSchema = z.object({ data: ChannelMessageRequestSchema.nullable() }).openapi('ChannelMessageRequestResponse');
export type ChannelMessageRequestResponse = z.infer<typeof ChannelMessageRequestResponseSchema>;
export const ChannelMessageRequestListResponseSchema = z.object({ data: z.array(ChannelMessageRequestSchema) }).openapi('ChannelMessageRequestListResponse');
export type ChannelMessageRequestListResponse = z.infer<typeof ChannelMessageRequestListResponseSchema>;

// ── Meeting Sessions (Channel Voice) ─────────────────────────────────────────
export const ChannelVoiceSessionResponseSchema = z.object({ data: MeetingSessionSchema }).openapi('ChannelVoiceSessionResponse');
export type ChannelVoiceSessionResponse = z.infer<typeof ChannelVoiceSessionResponseSchema>;

// ── Platform ──────────────────────────────────────────────────────────────────
export const TenantListResponseSchema = z.object({ data: z.array(TenantSummarySchema) }).openapi('TenantListResponse');
export type TenantListResponse = z.infer<typeof TenantListResponseSchema>;
export const RuntimeHealthResponseSchema = z.object({ data: RuntimeHealthSummarySchema }).openapi('RuntimeHealthResponse');
export type RuntimeHealthResponse = z.infer<typeof RuntimeHealthResponseSchema>;
export const PlatformRuntimeSummaryResponseSchema = z.object({ data: PlatformRuntimeSummarySchema }).openapi('PlatformRuntimeSummaryResponse');
export type PlatformRuntimeSummaryResponse = z.infer<typeof PlatformRuntimeSummaryResponseSchema>;

// ── FreeSWITCH / Route Lookup ─────────────────────────────────────────────────
export const RouteLookupResponseSchema = z.object({
  matched: z.boolean(),
  route_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  target_type: z.string().optional(),
  target_id: z.string().uuid().nullable().optional(),
  target: z.record(z.unknown()).nullable().optional(),
}).openapi('RouteLookupResponse');
export type RouteLookupResponse = z.infer<typeof RouteLookupResponseSchema>;
