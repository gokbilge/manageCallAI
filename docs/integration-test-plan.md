# Integration Test Plan

## Purpose

This document defines the first end-to-end integration test plan for proving the `manageCallAI` architecture.

## Target Outcome

Prove that:

- the API owns extension state
- PostgreSQL stores canonical state
- FreeSWITCH can consume runtime-facing data through `mod_xml_curl`
- the adapter can ingest events
- the API can expose observed runtime behavior

## Test Plan

1. Start PostgreSQL
2. Run migrations
3. Start API
4. Create extension
5. Hit directory endpoint with a FreeSWITCH-style request
6. Verify XML directory response
7. Register SIP phone
8. Confirm event ingestion
9. Fetch event through API

## Detailed Steps

### 1. Start PostgreSQL

Use:

```bash
pnpm db:up
```

### 2. Run migrations

Use:

```bash
pnpm db:migrate
pnpm db:status
```

Expected:

- baseline migration applied
- schema tables exist

### 3. Start API

Expected:

- API health endpoint responds successfully
- API can connect to PostgreSQL

### 4. Create extension

Use the API to create an active extension such as `1001`.

Expected:

- extension row exists in PostgreSQL
- extension can later be resolved by directory lookup

### 5. Hit directory endpoint

Send a FreeSWITCH-style directory lookup request for extension `1001`.

Expected:

- valid XML response
- returned user matches stored extension data

### 6. Verify XML directory response

Check:

- XML is syntactically valid
- extension number is present
- display name is present
- required user variables are present

### 7. Register SIP phone

Register a SIP phone or softphone against FreeSWITCH using the created extension.

Expected:

- registration completes successfully

### 8. Confirm event ingestion

Expected:

- adapter logs an MVP registration-like event or call lifecycle event
- normalized event is persisted or made available to the backend

### 9. Fetch event through API

Use the API to list or fetch stored event data.

Expected:

- relevant event is visible through the API

## MVP Pass Condition

The test passes if one complete extension-registration-observation loop succeeds without manual state editing inside FreeSWITCH.
