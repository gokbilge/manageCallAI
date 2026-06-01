# FreeSWITCH Hardening Guide

Production hardening checklist for FreeSWITCH in a manageCallAI deployment.
Apply before enabling live SIP traffic.

Run the automated checker at any time:

```sh
pnpm check:freeswitch-hardening
```

## ESL (Event Socket Layer)

ESL is a full-control interface. An accessible ESL endpoint with any password
is a critical compromise vector.

- **Set `listen-ip` to `127.0.0.1`** — never `0.0.0.0`. The Go agent connects
  locally; ESL should never be internet-accessible.
- **Change the ESL password** from the default to a strong random value
  (`openssl rand -hex 16`). Set `FREESWITCH_ESL_PASSWORD` in the deployment
  environment.
- **Set `apply-inbound-acl` to `loopback.auto`** or a named ACL covering only
  the agent host.
- Block port 8021/tcp at the firewall for all external sources.

Use `freeswitch/conf/autoload_configs/event_socket.conf.xml.production.example`
as the starting point.

## Default Password

The default FreeSWITCH ESL password must be changed before production traffic.
The production preflight (`pnpm production:preflight`) and the FreeSWITCH
hardening check (`pnpm check:freeswitch-hardening`) both fail if the ESL
password is the stock vendor default.

## SIP Profiles: Separate Internal and External

Use separate sofia profiles for internal (agent-to-agent) and external
(carrier-facing) traffic:

- **Internal profile**: `sip_profiles/internal.xml` — bind to the private
  interface, disable anonymous calls, require authentication for all registrations.
- **External profile**: `sip_profiles/external.xml` or `external-tls.xml` —
  restrict source IPs to known carrier CIDRs where possible.

See `freeswitch/conf/examples/tls/sofia-profile-tls.xml` for a production TLS
profile example.

## Anonymous and Guest Calling

Disable anonymous calling unless explicitly required:

```xml
<!-- In the dialplan default context — block anonymous INVITEs -->
<condition field="${caller_id_number}" expression="^anonymous$" break="always">
  <action application="reject" data="403"/>
</condition>
```

In the sofia profile:

```xml
<param name="log-auth-failures" value="true"/>
<param name="challenge-realm" value="auto_from"/>
```

## Disable Unused Modules

FreeSWITCH loads many modules by default. Disable those not used by
manageCallAI to reduce attack surface. Keep:

| Module | Purpose |
|---|---|
| `mod_sofia` | SIP signaling |
| `mod_lua` | IVR Lua executor |
| `mod_xml_curl` | Directory and dialplan XML over HTTP |
| `mod_callcenter` | Call queuing |
| `mod_voicemail` | Voicemail |
| `mod_dptools` | Basic dialplan tools |
| `mod_commands` | ESL command interface |
| `mod_event_socket` | ESL |
| `mod_logfile` | File logging |
| `mod_console` | Console logging |
| `mod_enum` | ENUM lookups (if needed) |
| `mod_tone_stream` | Hold music and tones |
| `mod_sndfile` | Audio file playback |
| `mod_native_file` | Raw audio format support |
| `mod_spandsp` | Inband DTMF, fax (if needed) |

Disable or comment out modules you do not use in `autoload_configs/modules.conf.xml`.

Modules to review for disabling in a carrier-only deployment:

- `mod_verto` — WebRTC (disable unless using WebRTC)
- `mod_rtc` — WebRTC (disable unless using WebRTC)
- `mod_dingaling` — XMPP (disable)
- `mod_xml_rpc` — HTTP XML-RPC control interface (disable unless explicitly needed)
- `mod_http_cache` — HTTP caching (disable unless needed)
- `mod_python` / `mod_perl` / `mod_ruby` — scripting engines (disable unused ones)

## Dialplan Exposure

The manageCallAI API generates gateway XML for each trunk via mod_xml_curl.
Keep the dialplan minimal:

- Only route calls that match an active inbound route.
- Reject unmatched calls with 403 or 404 at the public context entry point.
- Do not expose internal extensions in the public dialplan context.
- Confirm that `managecall_entry.xml` blocks calls that do not match a route.

See `freeswitch/conf/dialplan/managecall_entry.xml.example`.

## Outbound Route Restrictions

Outbound calls are initiated through the API's outbound call endpoint, which
is capability-gated and fraud-policy-controlled. FreeSWITCH should not be able
to originate calls outside of the gateway XML provided by the API.

- Do not add static outbound routes that bypass the API.
- Restrict dialplan patterns to the prefixes defined in active SIP trunks.

## Log Level Policy

In production, set the FreeSWITCH log level to reduce noise while retaining
security-relevant events:

```xml
<!-- In autoload_configs/logfile.conf.xml -->
<param name="loglevel" value="warning"/>
```

Ensure auth failure events are always logged:

```xml
<param name="log-auth-failures" value="true"/>
```

Rotate logs regularly. Do not retain logs containing SIP credentials or customer
call payloads longer than required by your retention policy.

## Recording Storage Permissions

If using FreeSWITCH native recording, ensure the recording directory:

```sh
chown -R freeswitch:freeswitch /path/to/recordings
chmod 700 /path/to/recordings
```

Recordings are referenced by `storage_reference` in the `recordings` table.
The API controls access; FreeSWITCH should only write, not serve, recordings.

## Container User and Permissions (Docker)

In the Docker deployment, FreeSWITCH runs as the `freeswitch` user. Verify:

```sh
docker exec freeswitch id
# uid=1000(freeswitch) gid=1000(freeswitch)
```

The container should not run as root. The Dockerfile uses `USER freeswitch`.
TLS certificates and the configuration directory are mounted read-only where
possible.

## Fail2ban / SIP Scanner Blocking

Deploy Fail2ban with the FreeSWITCH jail to block SIP scanners:

```ini
[freeswitch]
enabled  = true
port     = 5060,5061,5080
filter   = freeswitch
logpath  = /var/log/freeswitch/freeswitch.log
maxretry = 10
findtime = 60
bantime  = 3600
```

Alternatively, use cloud firewall rules to restrict SIP source IPs to known
carrier CIDRs.

## Pre-Deployment Verification

```sh
pnpm check:freeswitch-hardening    # all automated checks
pnpm production:preflight          # secrets and env
pnpm check:network-config          # ESL exposure and port rules
```

All three must pass before live SIP traffic is enabled.

## Related Documents

- `docs/ops/network-hardening.md` — network-level hardening
- `docs/ops/sip-tls-srtp-nat.md` — SIP TLS, SRTP, NAT
- `docs/ops/firewall-rules.md` — port exposure rules
- `docs/ops/runtime-edge-security.md` — ESL and runtime HTTP model
