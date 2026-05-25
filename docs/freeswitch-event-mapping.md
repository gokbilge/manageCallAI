# FreeSWITCH Event Mapping

## Purpose

This document defines the MVP ESL event-ingestion and normalization strategy for `manageCallAI`.

## MVP Goal

The first goal is to prove:

1. FreeSWITCH emits runtime events
2. the adapter can connect through ESL / `mod_event_socket`
3. events can be normalized
4. normalized events can be stored and surfaced through the API

## MVP Event Set

Recommended first event set:

- registration-related visibility event if available in the chosen FreeSWITCH event stream
- `CHANNEL_CREATE`
- `CHANNEL_ANSWER`
- `CHANNEL_HANGUP`

Optional early additions:

- `CHANNEL_DESTROY`
- `HEARTBEAT`

## Events Ignored in MVP

Ignore initially:

- verbose media-level events
- codec negotiation detail events
- advanced conference events
- non-essential custom module events

## Normalized Event Shape

Minimum normalized event structure:

```json
{
  "eventType": "CHANNEL_ANSWER",
  "callId": "uuid-value",
  "occurredAt": "2026-05-26T00:00:00Z",
  "source": "freeswitch-esl",
  "tenantHint": "default",
  "registrationId": "",
  "payload": {
    "rawEventName": "CHANNEL_ANSWER"
  }
}
```

## Mapping to `call_events`

Recommended MVP mapping:

- `call_id`
  from FreeSWITCH unique call UUID

- `event_type`
  normalized event type such as `registration_seen`, `channel_create`, `channel_answer`, `channel_hangup`

- `event_time`
  timestamp derived from the event payload or ingestion time

- `source`
  `freeswitch-esl`

- `payload`
  minimal raw event details useful for later debugging

## Registration Event Handling

Registration behavior varies depending on exact FreeSWITCH setup and event availability.

For MVP:

- ingest the first reliable registration-like event available in the chosen deployment
- normalize it as `registration_seen`
- store extension/user hints if available

Minimum registration payload:

```json
{
  "extensionNumber": "1001",
  "domain": "pbx.local",
  "networkIp": "192.0.2.10",
  "userAgent": "softphone"
}
```

## Call Lifecycle Mapping

- `CHANNEL_CREATE` -> `channel_create`
- `CHANNEL_ANSWER` -> `channel_answer`
- `CHANNEL_HANGUP` -> `channel_hangup`

Recommended preserved raw fields:

- FreeSWITCH event name
- channel UUID
- caller number
- destination number
- hangup cause if present

## Adapter Responsibilities

- connect to ESL
- subscribe only to needed events first
- normalize events into stable backend-facing shapes
- avoid embedding business decisions into the adapter

## Notes

- Event normalization should stay stable even if raw FreeSWITCH event payloads vary.
- Tenant resolution may be implicit for MVP.
- The adapter should log ignored event types at debug level only.
