# SLICE-47 Recording Retention And Privacy

## Priority

P1 - security

## Status

Planned

## Goal

Implement configurable retention and privacy controls for recordings, voicemail,
CDRs, transcripts, summaries, and exports.

## Scope

- Tenant retention policy table.
- Legal hold model.
- Purge worker for media and derived analysis.
- Export audit records.
- Support-bundle privacy checks.
- Tests for tenant-scoped purge and legal hold behavior.

## Acceptance Criteria

- Retention is tenant-scoped and auditable.
- Purge removes derived transcript and summary data with the recording.
- Legal hold prevents deletion.
- Exports are audited and require explicit capabilities.
