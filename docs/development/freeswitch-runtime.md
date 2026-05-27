# FreeSWITCH Runtime

This document explains the FreeSWITCH integration layer in manageCallAI,
why it builds from source, and how contributors can work with or without it.

## Architecture

manageCallAI uses **stock FreeSWITCH** with no fork and no custom C patches.
The integration points are:

| Integration | Mechanism |
|-------------|-----------|
| SIP registration / auth | `mod_xml_curl` -> `GET /api/v1/freeswitch/directory` |
| Inbound DID routing to extension targets | `mod_xml_curl` -> `GET/POST /api/v1/freeswitch/dialplan` |
| Inbound DID routing to flow targets | Lua helper -> `GET /api/v1/freeswitch/route-lookup` -> runtime session endpoints |
| Call event ingestion | Go ESL agent -> `POST /api/v1/call-events/internal/ingest` |

The runtime API token (`RUNTIME_API_TOKEN`) protects all runtime-only paths.
User JWTs are never used for runtime calls.

## Why source build?

The FreeSWITCH Docker Hub image is not regularly maintained. The official
packages require a paid subscription for production builds. Building from source
gives a reproducible image pinned to a known tag (for example `v1.10.12`) with
only the modules we need enabled.

The Dockerfile is at `freeswitch/docker/Dockerfile`. It pins the FreeSWITCH
version via build arg `FREESWITCH_VERSION` (default `v1.10.12`).

## Build time warning

The source build takes **10-25 minutes** depending on CPU and Docker cache
state. Subsequent builds of the same version are much faster because layer
caching reuses the compiled binary.

Contributors should complete the API-first smoke test
(`docs/development/first-vertical-slice.md`) before attempting the live runtime
proof. The API can be verified entirely without building FreeSWITCH.

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
| `MANAGECALLAI_DIRECTORY_URL` | FreeSWITCH -> `mod_xml_curl` directory binding |
| `MANAGECALLAI_DIALPLAN_URL` | FreeSWITCH -> `mod_xml_curl` dialplan binding |
| `MANAGECALLAI_API_BASE` | Lua fallback -> `route-lookup` |
| `RUNTIME_API_TOKEN` | All runtime paths |
| `FREESWITCH_ESL_PASSWORD` | Go agent ESL connection |

All have safe defaults in `docker-compose.yml` for local development. Override
them in `.env` for anything shared or production-like.

## Lua helpers

`freeswitch/lua/inbound_route.lua` is now the thin entry for inbound flow
targets. It resolves the DID through the backend and:

- bridges immediately for extension targets
- enters `managecall_entry.lua` for published flow targets

Dynamic dialplan projection through `mod_xml_curl` remains the preferred path
for direct extension targets.

`freeswitch/conf/dialplan/inbound_did.xml.example` is the example static
dialplan fragment for the Lua fallback path. Copy it to
`conf/dialplan/inbound_did.xml` inside the container (or bake it into the
image) and run `reloadxml` only when you are intentionally using that fallback.

## Future: prebuilt GHCR image

A prebuilt FreeSWITCH image pinned to `v1.10.12` with manageCallAI runtime
overlays baked in can later be published to GHCR. The source-build Dockerfile
should remain in the repository for reproducibility and custom builds.

## Modules used

| Module | Purpose |
|--------|---------|
| `mod_xml_curl` | Dynamic directory and dialplan XML from API |
| `mod_event_socket` | ESL connection for the Go agent |
| `mod_lua` | Thin fallback helper scripts |
| `mod_sofia` | SIP stack |

No other custom modules are loaded. The standard FreeSWITCH default config
provides the base; manageCallAI overlays only what is needed.

## Troubleshooting

**FS can't reach the API**
- Both must be on the same Docker network.
- Use the Docker service name `api`, not `localhost`.
- Check `MANAGECALLAI_DIRECTORY_URL`, `MANAGECALLAI_DIALPLAN_URL`, and
  `MANAGECALLAI_API_BASE` point to `http://api:3000/...`.

**Dialplan lookup returns an empty context**
- Verify the request includes the tenant `domain` or `domain_name`.
- Verify the route is published, not just drafted.
- Verify the route target is currently an active `extension`.

**Inbound flow target hangs up immediately**
- Check `docker logs managecallai-freeswitch-1` for `managecall_entry.lua` errors.
- Verify `MANAGECALLAI_API_BASE` ends with `/api/v1` with no trailing slash.
- Verify the target flow is published and the prompt assets referenced by the flow are active and have a valid `storage_uri`.

**Lua fallback fails silently**
- Check `docker logs managecallai-freeswitch-1` for Lua errors.
- Verify `MANAGECALLAI_API_BASE` ends with `/api/v1` with no trailing slash.
- DID must be URL-encoded: `+` -> `%2B`.

**ESL agent won't connect**
- `FREESWITCH_ESL_PASSWORD` must match in both FreeSWITCH config and agent env.
- Default password is `ClueCon` and should be changed in production.

**Source build fails**
- Ensure Docker has at least 4 GB of memory allocated.
- Try `docker compose --profile freeswitch build --no-cache freeswitch`.
- Check for transient network failures fetching FreeSWITCH source.
