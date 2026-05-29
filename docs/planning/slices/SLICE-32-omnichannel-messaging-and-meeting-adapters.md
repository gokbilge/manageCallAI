# SLICE-32 Omnichannel Messaging and Meeting Adapters

## Goal

Define integration contracts for WhatsApp, Telegram, and Google Meet so manageCallAI
can route messages, voice-like interactions, meeting links, recordings, and AI-assisted
responses through channel adapters without coupling the telecom core to any provider.

## Status

**PLANNED**

## Context

The core platform models telecom desired state and runtime events. Messaging and
meeting platforms have different capabilities and compliance rules:

- WhatsApp supports official business messaging through the WhatsApp Business Platform.
  Business voice/calling support depends on Meta availability, business eligibility,
  and sometimes a provider/BSP configuration.
- Telegram Bot API supports bot messaging and voice/audio messages. Official bot
  support should not be treated as a PSTN-style voice-call replacement.
- Google Meet REST APIs can create/manage meeting spaces and retrieve participants,
  recordings, and transcripts. Live media participation requires separate Meet media
  or SIP-capable integration patterns and should be represented as a capability.

## Scope

- Add provider-neutral channel account contracts for WhatsApp, Telegram, Google Meet,
  and custom adapters.
- Add inbound message event contract normalized across channels.
- Add outbound message request contract with channel-specific provider metadata isolated.
- Add voice capability model:
  - `voice_message` for asynchronous audio messages
  - `native_call` for provider-supported voice calling
  - `meeting` for Google Meet-style conferencing
  - `sip_bridge` for channels that can bridge through SIP or a provider gateway
- Add meeting session contract for Google Meet links, participants, recordings, and
  transcript artifact metadata.
- Add AI handoff hooks so channel messages can create IVR AI turn requests or use the
  same prompt/recording analysis contracts.
- Add webhook ingestion endpoints for provider callbacks.
- Document provider restrictions and forbid unofficial automation paths in release docs.

## Depends On

- `SLICE-20`
- `SLICE-25`
- `SLICE-27`
- `SLICE-31`

## Parallel With

- `SLICE-30`
- `SLICE-31`

## Unblocks

- WhatsApp customer messaging workflows
- Telegram bot support workflows
- Google Meet escalation from call/chat workflows
- AI-assisted customer question handling outside phone calls
- future channel-specific plugins

## Exit Criteria

- channel account contract supports provider type, status, capabilities, and metadata
- inbound and outbound message contracts are channel-neutral
- voice/meeting capabilities are explicit and not assumed for every provider
- provider callbacks are authenticated and tenant-scoped
- OpenAPI documents the contracts before provider implementations are added

## Out Of Scope

- shipping a bundled WhatsApp, Telegram, or Google Meet provider
- unofficial WhatsApp or Telegram automation
- guaranteeing WhatsApp voice availability for every business account
- joining Google Meet as a live media bot without an approved media/SIP integration
- storing provider credentials in public API responses
