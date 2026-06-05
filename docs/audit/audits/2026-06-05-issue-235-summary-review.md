# Audit: Issue 235 Summary Review Surfaces

Date: 2026-06-05

## Scope

`v0.6` issue `#235`:

- recording summary review API
- voicemail-linked summary review API
- call-detail and recording review UI
- retention and transcript-access behavior

## Findings

### Closed

1. Summary review now stays bounded to API-owned recording-analysis records.
2. Transcript text is additionally gated by `tenant.compliance.admin`.
3. Voicemail review fails closed when no linked recording exists for the same
   tenant and `call_id`.
4. Recording and call-detail UI show explicit missing-analysis and unavailable
   states instead of implying that a summary exists.

### Open

1. Local API integration validation for the new endpoints was not completed on
   this workstation because PostgreSQL was not available at `localhost:5432`.
   CI must provide the real pass/fail signal for those tests.

## Evidence

- API unit tests:
  - `apps/api/src/modules/recordings/recording.service.test.ts`
  - `apps/api/src/modules/voicemail-boxes/voicemail-message.service.test.ts`
- API integration test added:
  - `apps/api/src/modules/recordings/recording-summary.integration.test.ts`
- Web tests:
  - `apps/web/src/features/recordings/recordings-page.test.tsx`
  - `apps/web/src/features/calls/calls-page.test.tsx`
- Web coverage after the slice:
  - statements `85.69%`
  - branches `80.33%`
  - functions `83.75%`
  - lines `86.43%`

## Follow-up

- Watch CI for `recording-summary.integration.test.ts`.
- If CI lacks a PostgreSQL service for API integration tests, fix the workflow
  instead of weakening the test.
