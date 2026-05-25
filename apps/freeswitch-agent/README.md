# freeswitch-agent

Go adapter service for `manageCallAI` FreeSWITCH runtime integration.

## Scope

- Connect to FreeSWITCH ESL / `mod_event_socket`
- Normalize runtime events
- Forward or persist runtime event data through the control-plane boundary
- Keep project-specific business logic outside FreeSWITCH

## Environment Variables

- `FREESWITCH_ESL_HOST`
- `FREESWITCH_ESL_PORT`
- `FREESWITCH_ESL_PASSWORD`
- `MANAGECALLAI_TENANT_ID`
- `API_BASE_URL`
- `LOG_LEVEL`

## Run

```bash
go run .
```

## Notes

- The agent authenticates to ESL, subscribes to MVP events, normalizes them, and forwards them to the API.
- `MANAGECALLAI_TENANT_ID` must be set to a real tenant UUID so forwarded events satisfy the database foreign key.
