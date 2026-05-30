# Planning

This directory defines the remaining path from the current proven MVP foundation
to a release-ready `manageCallAI` product.

These documents are planning guides, not architecture authority.

- Canonical architecture: [../architecture/source-of-truth.md](../architecture/source-of-truth.md)
- Current IVR architecture: [../ivr/IVR_ARCHITECTURE.md](../ivr/IVR_ARCHITECTURE.md)

If a planning document conflicts with the architecture docs, architecture wins.

## Contents

- [release-plan.md](release-plan.md)
  Release roadmap, execution order, dependency graph, and parallel work tracks.

- [post-release-roadmap.md](post-release-roadmap.md)
  Seven post-release expansion workstreams that now map to explicit follow-on slices.

- [verification/slice-07-live-proof.md](verification/slice-07-live-proof.md)
  Live close-out checklist for the inbound IVR and call-group runtime proof.

- [slices/SLICE-00-current-baseline.md](slices/SLICE-00-current-baseline.md)
  What is already proven and should not be re-opened casually.

- [slices/SLICE-01-admin-surface-completion.md](slices/SLICE-01-admin-surface-completion.md)
  Complete tenant operator surfaces for numbers, routes, and prompts.

- [slices/SLICE-02-approval-operations.md](slices/SLICE-02-approval-operations.md)
  Approval decision APIs and operator review surfaces.

- [slices/SLICE-03-prompt-assets.md](slices/SLICE-03-prompt-assets.md)
  Prompt asset metadata and runtime-resolvable prompt references.

- [slices/SLICE-04-ivr-runtime-resolver.md](slices/SLICE-04-ivr-runtime-resolver.md)
  Backend flow-session resolver and next-action contract.

- [slices/SLICE-05-freeswitch-runtime-loop.md](slices/SLICE-05-freeswitch-runtime-loop.md)
  Thin Lua execution loop over stock FreeSWITCH.

- [slices/SLICE-06-call-groups.md](slices/SLICE-06-call-groups.md)
  Call groups / ring groups as desired-state targets.

- [slices/SLICE-07-inbound-ivr-and-call-group-projection.md](slices/SLICE-07-inbound-ivr-and-call-group-projection.md)
  Bind inbound DID routing to published IVR and call-group targets.

- [slices/SLICE-08-visual-builder.md](slices/SLICE-08-visual-builder.md)
  React Flow builder over the same desired-state model.

- [slices/SLICE-09-n8n-surfaces.md](slices/SLICE-09-n8n-surfaces.md)
  n8n-safe draft, validate, simulate, and publish-request integration.

- [slices/SLICE-10-mcp-surfaces.md](slices/SLICE-10-mcp-surfaces.md)
  MCP-safe IVR tools over the same desired-state lifecycle.

- [slices/SLICE-11-release-hardening.md](slices/SLICE-11-release-hardening.md)
  Final release gates, smoke tests, docs, security, and operations readiness.

- [slices/SLICE-12-outbound-event-delivery.md](slices/SLICE-12-outbound-event-delivery.md)
  Webhook subscription management and outbound event delivery for n8n and external consumers.

- [slices/SLICE-13-post-release-expansion.md](slices/SLICE-13-post-release-expansion.md)
  Umbrella/index for the explicit post-release slices below.

- [slices/SLICE-14-operator-surface-gaps.md](slices/SLICE-14-operator-surface-gaps.md)
  Sidebar nav completeness, prompt assets web page, and runtime session observability.

- [slices/SLICE-15-advanced-ivr-node-types.md](slices/SLICE-15-advanced-ivr-node-types.md)
  Advanced IVR node types on top of the current flow/runtime foundation.

- [slices/SLICE-16-queue-and-voicemail-models.md](slices/SLICE-16-queue-and-voicemail-models.md)
  Queue and voicemail desired-state resources and target resolution.

- [slices/SLICE-17-schedule-aware-routing.md](slices/SLICE-17-schedule-aware-routing.md)
  Schedule, holiday, and conditional routing primitives.

- [slices/SLICE-18-outbound-routing-and-trunk-policy.md](slices/SLICE-18-outbound-routing-and-trunk-policy.md)
  Outbound routing rules and trunk-selection policy.

- [slices/SLICE-19-observability-and-operations-depth.md](slices/SLICE-19-observability-and-operations-depth.md)
  Session replay, deeper audit, runtime metrics, and operator debugging.

- [slices/SLICE-20-automation-and-ai-depth.md](slices/SLICE-20-automation-and-ai-depth.md)
  Stronger n8n/MCP/AI automation depth on the same safe lifecycle.

- [slices/SLICE-21-enterprise-and-multi-tenant-hardening.md](slices/SLICE-21-enterprise-and-multi-tenant-hardening.md)
  Enterprise identity, topology, and compliance-oriented hardening.

- [slices/SLICE-22-recorded-media-and-export-operations.md](slices/SLICE-22-recorded-media-and-export-operations.md)
  Call recording, playback, and export/reporting follow-on work after core observability.

- [slices/SLICE-23-caller-routing-and-outbound-runtime.md](slices/SLICE-23-caller-routing-and-outbound-runtime.md)
  Caller-ID-aware IVR branching and outbound runtime/click-to-call integration.

- [slices/SLICE-24-tenant-user-management.md](slices/SLICE-24-tenant-user-management.md)
  Tenant-scoped user listing, creation, role updates, and deactivation.

- [slices/SLICE-25-webhook-delivery-queue.md](slices/SLICE-25-webhook-delivery-queue.md)
  Durable webhook delivery queue with retry state and tenant-visible status.

- [slices/SLICE-26-live-runtime-smoke-automation.md](slices/SLICE-26-live-runtime-smoke-automation.md)
  Repeatable live runtime smoke automation for release candidate validation.

- [slices/SLICE-27-session-replay-ui-and-api.md](slices/SLICE-27-session-replay-ui-and-api.md)
  Operator-facing IVR session replay API and web UI.

- [slices/SLICE-28-voicemail-media-capture-and-playback.md](slices/SLICE-28-voicemail-media-capture-and-playback.md)
  Runtime voicemail capture, recording metadata, and playback-safe review.

- [slices/SLICE-29-outbound-call-execution-hardening.md](slices/SLICE-29-outbound-call-execution-hardening.md)
  Release-ready click-to-call execution and outbound request status tracking.

- [slices/SLICE-30-automation-operator-tools.md](slices/SLICE-30-automation-operator-tools.md)
  MCP and n8n-oriented tools for approvals, session trace, recordings, and exports.

- [slices/SLICE-31-prompt-and-ivr-ai-integration-contracts.md](slices/SLICE-31-prompt-and-ivr-ai-integration-contracts.md)
  Provider-neutral contracts for generated prompts, TTS, STT, and AI-assisted IVR turns.

- [slices/SLICE-32-omnichannel-messaging-and-meeting-adapters.md](slices/SLICE-32-omnichannel-messaging-and-meeting-adapters.md)
  Provider-neutral contracts for WhatsApp, Telegram, Google Meet, and custom channel adapters.

- [slices/SLICE-35-bpmn-inspired-ivr-graph-model.md](slices/SLICE-35-bpmn-inspired-ivr-graph-model.md)
  Constrained BPMN-inspired graph semantics for visual IVR authoring.

- [slices/SLICE-36-visual-ivr-execution-engine.md](slices/SLICE-36-visual-ivr-execution-engine.md)
  Shared validation, simulation, and runtime execution planner for visual IVR graphs.

- [slices/SLICE-37-live-observability-cockpit.md](slices/SLICE-37-live-observability-cockpit.md)
  Real-time live operations cockpit for active calls, queues, runtime health, and adapter backlogs.

- [slices/SLICE-38-mcp-contract-alignment.md](slices/SLICE-38-mcp-contract-alignment.md)
  Generated/shared MCP contracts to prevent REST, IVR, and tool-schema drift.

- [slices/SLICE-39-ci-telecom-safety-gates.md](slices/SLICE-39-ci-telecom-safety-gates.md)
  Migration replay, runtime golden files, secret scanning, dependency audit, Docker,
  MCP contract, and FreeSWITCH-profile smoke gates.

- [slices/SLICE-40-p1-runtime-and-operations-hardening.md](slices/SLICE-40-p1-runtime-and-operations-hardening.md)
  P1 runtime, IVR, automation, AI/MCP, and operations hardening backlog with
  implemented outbound and queue safety foundations.

- [slices/SLICE-41-p1-leftover-telecom-ops-and-ai-hardening.md](slices/SLICE-41-p1-leftover-telecom-ops-and-ai-hardening.md)
  Remaining P1 telecom deployment, IVR builder/runtime, AI/MCP, automation, and
  operations hardening work after the Slice 40 runtime-safety foundation.

- [slices/SLICE-42-ai-dry-run-audit-identity-and-tracing.md](slices/SLICE-42-ai-dry-run-audit-identity-and-tracing.md)
  Focused follow-on for AI dry-run mutation mode, distinct AI/MCP audit identity,
  and OpenTelemetry tracing.

## Reading Order

1. Read [release-plan.md](release-plan.md)
2. Read the slice docs in numeric order
3. Use `depends_on` and `parallel_with` to decide staffing

## Planning Rule

Each slice should be considered complete only when:

- code is merged
- docs are aligned
- tests exist for the slice
- the slice exit criteria are met
