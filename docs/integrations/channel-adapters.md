# Channel Adapter Services

manageCallAI does not embed WhatsApp, Telegram, Google Meet, or custom provider
workers inside `apps/api`. The API owns normalized channel state and exposes
runtime-token authenticated contracts for independent adapter services.

## Adapter Contract

External adapters should:

- read channel account configuration from manageCallAI
- claim queued outbound message work through
  `POST /api/v1/channels/messages/outbound/internal/claim`
- deliver the message through the provider-specific API
- report delivery state through
  `POST /api/v1/channels/messages/outbound/{requestId}/internal/result`
- ingest inbound provider events through
  `POST /api/v1/channels/messages/inbound/internal`
- create or update meeting/session records through the channel voice-session APIs

Adapters must authenticate with the runtime token and must not write directly to
PostgreSQL.

## Placeholders

The following provider implementations are intentionally placeholders in this
repository:

- WhatsApp Business adapter service
- Telegram Bot adapter service
- Google Meet adapter service
- Custom provider adapter service template

Provider SDK dependencies, token refresh, signature verification, webhook hosting,
delivery retries, and provider-specific compliance behavior belong in those
external services.
