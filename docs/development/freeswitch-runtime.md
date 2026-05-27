# FreeSWITCH Runtime

This document explains the FreeSWITCH integration layer in manageCallAI,
why it builds from source, and how contributors can work with or without it.

## Architecture

manageCallAI uses **stock FreeSWITCH** — no fork, no custom C patches. The
integration points are:

| Integration | Mechanism |
|-------------|-----------|
| SIP registration / auth | `mod_xml_curl` → `GET /api/v1/freeswitch/directory` |
| Inbound DID routing | Lua script → `GET /api/v1/freeswitch/route-lookup` |
| Call event ingestion | Go ESL agent → `POST /api/v1/call-events/internal/ingest` |

The runtime API token (`RUNTIME_API_TOKEN`) protects all three paths. User JWTs
are never used for runtime calls.

## Why source build?

The FreeSWITCH Docker Hub image is not regularly maintained. The official
packages require a paid subscription for production builds. Building from source
gives a reproducible image pinned to a known tag (e.g. `v1.10.12`) with only
the modules we need enabled.

The Dockerfile is at `freeswitch/docker/Dockerfile`. It pins the FreeSWITCH
version via build arg `FREESWITCH_VERSION` (default `v1.10.12`).

## Build time warning

The source build takes **10–25 minutes** depending on CPU and Docker cache state.
Subsequent builds of the same version are fast because layer caching reuses the
compiled binary.

Contributors should complete the API-first smoke test
(`docs/development/first-vertical-slice.md`) before attempting the live runtime
proof — the API can be verified entirely without building FreeSWITCH.

## Compose profiles

`docker compose up -d` starts only `postgres` and `api` by default.

FreeSWITCH and the Go ESL agent are behind the `freeswitch` profile:

```sh
# Start everything including FreeSWITCH (triggers source build on first run)
docker compose --profile freeswitch up -d

# Convenience alias in package.json
pnpm runtime:up
pnpm runtime:down
```

## Required environment variables

| Variable | Used by |
|----------|---------|
| `MANAGECALLAI_DIRECTORY_URL` | FreeSWITCH → `mod_xml_curl` binding |
| `MANAGECALLAI_API_BASE` | FreeSWITCH Lua → `route-lookup` calls |
| `RUNTIME_API_TOKEN` | All three integration points |
| `FREESWITCH_ESL_PASSWORD` | Go agent ESL connection |

All have safe defaults in `docker-compose.yml` for local development. Override
in `.env` for anything shared or production-like.

## Lua helpers

`freeswitch/lua/inbound_route.lua` — called by the dialplan on every inbound
call. It reads `MANAGECALLAI_API_BASE` and `RUNTIME_API_TOKEN` from environment,
calls `route-lookup`, and bridges the call to the resolved extension.

`freeswitch/conf/dialplan/inbound_did.xml.example` — example dialplan fragment.
Copy to `conf/dialplan/inbound_did.xml` inside the container (or bake into the
image) and run `reloadxml`.

## Future: prebuilt GHCR image

A prebuilt FreeSWITCH image pinned to `v1.10.12` with manageCallAI Lua scripts
baked in will be published to GHCR. When available, the `freeswitch` service in
`docker-compose.yml` will switch to `image: ghcr.io/gokbilge/managecallai-freeswitch:v1.10.12`
and contributors will no longer need to build from source for the runtime proof.

The source-build Dockerfile will remain in the repository for reproducibility
and custom builds.

## Modules used

| Module | Purpose |
|--------|---------|
| `mod_xml_curl` | Dynamic directory XML from API |
| `mod_event_socket` | ESL connection for the Go agent |
| `mod_lua` | Inbound route Lua script |
| `mod_sofia` | SIP stack |

No other custom modules are loaded. The standard FreeSWITCH default config
provides the base; manageCallAI overlays only what is needed.

## Troubleshooting

**FS can't reach the API**
- Both must be on the same Docker network (the default compose network).
- Use the Docker service name `api`, not `localhost`.
- Check `MANAGECALLAI_DIRECTORY_URL` and `MANAGECALLAI_API_BASE` point to `http://api:3000/...`.

**Lua script fails silently**
- Check `docker logs managecallai-freeswitch-1` for Lua errors.
- Verify `MANAGECALLAI_API_BASE` ends with `/api/v1` (no trailing slash).
- DID must be URL-encoded: `+` → `%2B`.

**ESL agent won't connect**
- `FREESWITCH_ESL_PASSWORD` must match in both FS config and agent env.
- Default password is `ClueCon` (change in production).

**Source build fails**
- Ensure Docker has at least 4 GB of memory allocated.
- Try `docker compose --profile freeswitch build --no-cache freeswitch`.
- Check for transient network failures fetching FreeSWITCH source.
