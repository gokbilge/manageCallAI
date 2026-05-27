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
  Seven post-release expansion workstreams (advanced IVR nodes, queue/voicemail, schedule routing, outbound, observability, automation depth, enterprise hardening). Nothing here enters a sprint before v1 ships.

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
  Post-release parking lane for advanced telecom features and broader expansion work that should not block v1.

- [slices/SLICE-14-operator-surface-gaps.md](slices/SLICE-14-operator-surface-gaps.md)
  Sidebar nav completeness, prompt assets web page, and runtime session observability.

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
