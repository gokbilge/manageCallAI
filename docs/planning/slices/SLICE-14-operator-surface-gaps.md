# SLICE-14 Operator Surface Gaps

## Goal

Close the operator surface gaps left after SLICE-01 through SLICE-04:
sidebar navigation is missing links to implemented pages, and prompt assets
have no web management surface despite a complete API backend.

## Context

After SLICE-02 the approvals page is routed at `/tenant/approvals` but the
sidebar `tenantNav` array does not include it — operators can only reach it
by direct URL. The prompts module (SLICE-03) was implemented at the API layer
but no web feature exists; operators must call the API directly to register or
deactivate prompt assets. Both gaps block a usable first release.

## Scope

### Sidebar navigation completeness

- Add `Approvals` nav item (`/tenant/approvals`, `TENANT_APPROVALS_VIEW`
  capability guard, `ClipboardCheck` icon)
- Add `Prompts` nav item (`/tenant/prompts`, `TENANT_PROMPTS_VIEW`
  capability guard, `Mic` icon)

### Prompt assets web surface

- `GET /api/v1/prompts` hook (`usePromptAssets`) — list active and inactive assets
- `POST /api/v1/prompts` hook (`useCreatePromptAsset`) — register name, storage_uri, media_type
- `POST /api/v1/prompts/:id/deactivate` hook (`useDeactivatePromptAsset`)
- `PromptsPage` component: asset table (name, media_type, language, storage_uri, status)
  with deactivate button per active row; create form in the side panel
- Route `/tenant/prompts` under `TENANT_PROMPTS_VIEW` capability guard
- Path constant `tenant.prompts` in `paths.ts`
- Tests: loading state, data rows, error state, deactivate button (same pattern as numbers-page.test.tsx)

### Runtime session read surface (operator observability)

- `GET /api/v1/runtime/ivr/sessions` endpoint — list sessions by tenant with optional
  `status` filter; uses `TENANT_IVR_FLOWS_VIEW` capability (no new capability needed)
- `useRuntimeSessions` hook for the web
- `RuntimeSessionsPage` at `/tenant/runtime/sessions` — table showing call_id,
  flow name, status, current_node_id, created_at; read-only, no actions
- Tests: loading state, rows, error state

## Depends On

- `SLICE-01` (admin surface patterns)
- `SLICE-02` (approvals page now in nav)
- `SLICE-03` (prompt API already implemented)
- `SLICE-04` (runtime session table already exists)

## Parallel With

- `SLICE-06`
- `SLICE-07`
- `SLICE-08`

## Unblocks

- `SLICE-11` (release hardening needs complete operator surfaces before smoke
  tests can be written against real page paths)

## Exit Criteria

- Sidebar shows Approvals and Prompts nav items, each capability-gated
- Tenant operator can register a prompt asset (name + storage_uri) through the UI
- Tenant operator can deactivate a prompt from the UI
- Tenant operator can view IVR runtime sessions at `/tenant/runtime/sessions`
- All three new pages have component tests following the established pattern

## Out Of Scope

- File upload pipeline for prompt audio (storage_uri is typed in manually)
- Session replay or step-through debugging
- Call-level event webhook delivery (that is SLICE-12 + SLICE-09)
