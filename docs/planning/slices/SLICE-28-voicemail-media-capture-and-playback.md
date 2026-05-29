# SLICE-28 Voicemail Media Capture and Playback

## Goal

Complete the practical voicemail path: callers can leave a message, runtime stores the
recording reference, and operators can review it safely.

## Status

**PLANNED**

## Context

Voicemail boxes and recording metadata exist, but the release needs a complete missed
call workflow before voicemail is a credible user-facing feature. This slice wires the
runtime capture path to the existing metadata and adds playback-safe access.

## Scope

- Add or finalize an IVR/runtime action that records voicemail for a voicemail box.
- Extend the FreeSWITCH/Lua or agent path to capture completed voicemail metadata.
- Store recording metadata with tenant, call ID, voicemail box ID, status, duration, and
  storage reference.
- Add playback/download API with tenant checks and safe storage-path handling.
- Add operator UI for voicemail/recording review.
- Fire webhook event for new voicemail availability.
- Add a provider-neutral transcription and summarization integration contract for
  voicemail and call recordings.
- Add tests for metadata ingestion, tenant isolation, and UI access.

## Transcription and Summary Contract

This release should define the contract but not implement a concrete AI provider.
The contract must allow a future external plugin, worker, or AI endpoint to process
recorded media without exposing raw storage internals through public APIs.

Required API shape:

- `POST /api/v1/recordings/:id/analysis-requests` - tenant operator requests
  transcription, summary, or both for a recording.
- `GET /api/v1/recordings/:id/analysis-requests` - tenant operator lists processing
  requests and result status for that recording.
- `POST /api/v1/recording-analysis/internal/:requestId/result` - trusted processor
  callback writes completion, failure, transcript text, summary text, language, and
  provider metadata.

Required request fields:

- `requested_outputs`: array containing `transcript`, `summary`, or both
- `language_hint`: optional BCP 47 language tag such as `en-US` or `tr-TR`
- `metadata`: optional provider-neutral JSON object for future workflow hints

Required states:

- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

Required safety rules:

- analysis requests remain tenant-scoped and recording-scoped
- processor callbacks require a dedicated internal credential or runtime credential
- public responses do not expose raw storage paths, provider secrets, or temporary
  media URLs
- transcript and summary fields are nullable until processing completes
- failed processing stores a bounded error message safe for operator display

## Depends On

- `SLICE-16`
- `SLICE-22`
- `SLICE-25`

## Parallel With

- `SLICE-29`
- `SLICE-30`

## Unblocks

- complete missed-call workflow
- voicemail automation events
- recording-aware operator support

## Exit Criteria

- a voicemail recording can be captured in the runtime path and listed in the UI
- operators can access only tenant-owned voicemail media
- webhook delivery announces available voicemail metadata
- API contract exists for future transcription and summary processors
- failure states are represented without exposing raw storage internals

## Out Of Scope

- concrete transcription or AI-summary provider implementation
- automatic transcription on every recording
- provider-specific prompt engineering or model selection
- email notification delivery
- long-term object storage lifecycle policy
- legal retention policy automation
