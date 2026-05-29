# SLICE-31 Prompt and IVR AI Integration Contracts

## Goal

Define provider-neutral API contracts for generated IVR prompts, text-to-speech,
speech-to-text, and AI-assisted caller question handling without making any external
AI provider a hard dependency of the core platform.

## Status

**IMPLEMENTED**

## Context

Tenants may want to use external services such as OpenAI, ElevenLabs, Whisper-compatible
transcription, or a custom plugin for prompt generation and live IVR responses. The
release should define stable integration points now so user-provided plugins or
services can be added later without changing the public API vocabulary.

## Scope

- Add OpenAPI contracts for prompt generation requests.
- Support optional provider hints such as `openai`, `elevenlabs`, `whisper`,
  `external`, and `custom`.
- Add trusted processor claim/result callback contracts for prompt generation.
- Add runtime-internal IVR AI turn request and result contracts for caller questions.
- Keep media storage and provider credentials outside public tenant responses.
- Store provider metadata only for observability, not as required business logic.
- Document that provider execution is out of scope for this release.

## Depends On

- `SLICE-03`
- `SLICE-20`
- `SLICE-25`
- `SLICE-28`

## Parallel With

- `SLICE-30`

## Unblocks

- future generated prompt workflows
- future ElevenLabs/OpenAI/custom TTS integrations
- future AI answering nodes in IVR flows
- external plugin development against a stable API

## Exit Criteria

- OpenAPI includes prompt-generation request, claim, and result contracts
- OpenAPI includes IVR AI turn request, claim, and result contracts
- contracts are provider-neutral and do not require a specific AI vendor
- public responses avoid provider secrets and raw media storage internals

## Out Of Scope

- implementing a bundled OpenAI, ElevenLabs, or Whisper provider
- selecting a default model or prompt strategy
- autonomous production flow changes from AI output
- free-form raw provider payload passthrough as public API
