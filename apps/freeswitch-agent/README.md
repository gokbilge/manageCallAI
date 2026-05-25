# freeswitch-agent

Go adapter-service skeleton for `manageCallAI` FreeSWITCH runtime integration.

## Scope

- Connect to FreeSWITCH ESL / `mod_event_socket`
- Normalize runtime events
- Forward or persist runtime event data through the control-plane boundary
- Keep project-specific business logic outside FreeSWITCH

## Environment Variables

- `FREESWITCH_ESL_HOST`
- `FREESWITCH_ESL_PORT`
- `FREESWITCH_ESL_PASSWORD`
- `API_BASE_URL`
- `LOG_LEVEL`

## Run

```bash
go run .
```

## Notes

- Current ESL connectivity is a placeholder skeleton only.
- Connection, subscription, retry, and event-forwarding behavior still need full implementation.
