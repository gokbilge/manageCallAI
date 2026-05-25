# FreeSWITCH Runtime Integration

## Purpose

This document defines the runtime integration expectations between stock FreeSWITCH, `manageCallAI`, and the FreeSWITCH adapter service.

## Core Rule

Use stock FreeSWITCH.

Do not fork it.

Keep project-specific business logic outside the switch runtime.

## Supported Extension Interfaces

- `mod_xml_curl`
- `ESL` / `mod_event_socket`
- minimal Lua helper scripts

## What Stays Stock

- core SIP and media handling
- normal FreeSWITCH runtime behavior
- standard module loading

## What Is Project-Specific

- backend desired-state model
- API and business logic
- FreeSWITCH adapter service
- event normalization
- generated XML directory and dialplan responses

## Required Runtime Pieces

### `mod_xml_curl`

Used for:

- directory lookup
- later dialplan lookup

Expected backend role:

- serve XML directory responses from backend state

### ESL / `mod_event_socket`

Used for:

- event ingestion
- runtime visibility
- future narrow control actions where justified

Expected adapter role:

- connect externally
- subscribe to MVP events
- log and normalize event data

### Lua

Used only as a thin in-switch helper.

For MVP:

- `play_prompt`
- `play_collect`

Do not place business logic in Lua.

## Expected Config Inputs

### API

- `DATABASE_URL`
- `API_PORT`

### FreeSWITCH Adapter

- `FREESWITCH_ESL_HOST`
- `FREESWITCH_ESL_PORT`
- `FREESWITCH_ESL_PASSWORD`
- `API_BASE_URL`
- `LOG_LEVEL`

### FreeSWITCH

- `xml_curl` configured to hit the backend
- `event_socket` configured for the adapter

## Interaction Flow

1. Backend stores desired state in PostgreSQL
2. FreeSWITCH requests directory or dialplan data through `mod_xml_curl`
3. Backend returns generated XML
4. FreeSWITCH emits runtime events
5. Adapter consumes events through ESL
6. Adapter normalizes and forwards or persists event data

## Notes

- The adapter is integration infrastructure, not a second business backend.
- Backend and adapter contracts should stay explicit and narrow.
