# Firewall Rules Reference

Minimum production firewall baseline for a manageCallAI deployment. Adapt to
your cloud security groups, `iptables` rules, or network ACLs.

## Baseline Rules

| Port | Protocol | Direction | Source | Purpose |
|---|---|---|---|---|
| 22/tcp | SSH | inbound | admin CIDR only | management access |
| 80/tcp | HTTP | inbound | internet | optional redirect to 443 |
| 443/tcp | HTTPS | inbound | internet | web UI and public API (via reverse proxy) |
| 5060/udp | SIP UDP | inbound | carrier IPs or SBC | SIP signaling — only if UDP profile is used |
| 5061/tcp | SIP TLS | inbound | carrier IPs or SBC | SIP TLS signaling |
| 5080/tcp | SIP TCP/TLS | inbound | carrier IPs or SBC | external SIP profile — only if configured |
| 5080/udp | SIP UDP | inbound | carrier IPs or SBC | external SIP profile — only if configured |
| 16384–32768/udp | RTP | inbound | internet | media streams — use your configured RTP range |
| 8021/tcp | FreeSWITCH ESL | internal only | localhost or private subnet | ESL must not be public |
| 5432/tcp | PostgreSQL | internal only | API/worker hosts only | database must not be public |
| 3000/tcp | manageCallAI API | internal only | reverse proxy host only | API behind proxy only |
| 6379/tcp | Redis | internal only | API hosts only | rate-limit store must not be public |

## Hard Rules

- **Never expose ESL (8021/tcp) to the internet.** A reachable ESL with any
  password is a full-system compromise vector. Restrict to `127.0.0.1` or a
  private subnet with tight CIDR rules.

- **Never expose PostgreSQL (5432/tcp) to the internet.** Use a VPN, private
  subnet, or SSH tunnel for DBA access.

- **Never expose the manageCallAI API (3000/tcp) directly.** Put it behind a
  reverse proxy (nginx, Caddy, Traefik) that terminates TLS on 443 and forwards
  to localhost:3000.

- **Never expose Redis (6379/tcp) to the internet.** Rate-limit state and session
  data must not be remotely readable.

- **Only open SIP/RTP ports that your deployment actually uses.** If you only use
  SIP TLS, do not open 5060/udp. If carriers require UDP, open it with explicit
  source restrictions.

## RTP Port Range

Configure FreeSWITCH's RTP port range in `vars.xml` or a sofia profile:

```xml
<X-PRE-PROCESS cmd="set" data="rtp_start_port=16384"/>
<X-PRE-PROCESS cmd="set" data="rtp_end_port=32768"/>
```

Open only that range on your firewall. Default FreeSWITCH range is
16384–32768/udp (16384 ports). Smaller ranges reduce attack surface but also
reduce maximum concurrent RTP streams.

## SIP Source Restrictions

Restrict inbound SIP to known carrier IPs or SBC IP ranges wherever your
carrier provides them. For deployments without a fixed carrier IP:

- Use a SIP-aware firewall or Fail2ban to block scanner patterns.
- Enable FreeSWITCH ACLs (`autoload_configs/acl.conf.xml`) for trusted networks.
- Rate-limit SIP OPTIONS floods at the firewall level.

## Outbound Rules

Allow outbound on ports required by carriers (typically 5060/udp, 5061/tcp) and
the configured RTP range. Block all other outbound ports not required by your
deployment.

## Related Documents

- `docs/ops/network-hardening.md` — full hardening guide
- `docs/ops/sip-tls-srtp-nat.md` — SIP TLS, SRTP, and NAT configuration
- `docs/ops/runtime-edge-security.md` — ESL and runtime HTTP edge policy
