# SIP TLS, SRTP, and NAT Traversal

Configuration guide for securing FreeSWITCH signaling and media in a manageCallAI
deployment.

## SIP TLS

### Overview

SIP TLS encrypts the signaling channel between FreeSWITCH and carriers or SIP
clients. Port 5061/tcp is the standard SIP TLS port.

### Certificate Placement

Place certificate files in `/etc/freeswitch/tls/`:

```
/etc/freeswitch/tls/
  agent.pem        # certificate + private key (PEM, no passphrase)
  cafile.pem       # CA bundle trusted for client-side verification
```

The agent.pem file must contain the private key followed by the certificate
chain. Generate with your CA or with Let's Encrypt:

```sh
# Self-signed (development / internal only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=your-freeswitch-host.example.com"
cat key.pem cert.pem > /etc/freeswitch/tls/agent.pem

# Let's Encrypt via certbot (production)
certbot certonly --standalone -d freeswitch.example.com
cat /etc/letsencrypt/live/freeswitch.example.com/privkey.pem \
    /etc/letsencrypt/live/freeswitch.example.com/fullchain.pem \
    > /etc/freeswitch/tls/agent.pem
cp /etc/letsencrypt/live/freeswitch.example.com/chain.pem \
   /etc/freeswitch/tls/cafile.pem
```

Protect the TLS directory:

```sh
chown -R freeswitch:freeswitch /etc/freeswitch/tls
chmod 700 /etc/freeswitch/tls
chmod 600 /etc/freeswitch/tls/agent.pem
```

### Sofia Profile TLS Settings

Enable TLS in the sofia profile used for your trunks:

```xml
<!-- In autoload_configs/sofia.conf.xml or a per-profile file -->
<param name="tls" value="true"/>
<param name="tls-only" value="false"/>           <!-- set true to disallow plain SIP -->
<param name="tls-bind-params" value="transport=tls"/>
<param name="tls-sip-port" value="5061"/>
<param name="tls-passphrase" value=""/>
<param name="tls-verify-date" value="true"/>
<param name="tls-verify-policy" value="none"/>   <!-- set 'in' or 'all' for mutual TLS -->
<param name="tls-verify-depth" value="2"/>
<param name="tls-verify-in-subjects" value=""/>
<param name="tls-version" value="tlsv1.2,tlsv1.3"/>
```

For carrier trunks with `transport=tls`, the manageCallAI gateway XML builder
includes `transport=tls` in the gateway configuration. Verify `sip_profile`
on the trunk points to a TLS-enabled sofia profile.

### Testing TLS Registration

Use `sipp` or `sngrep` to verify TLS negotiation. A registered endpoint over
TLS will show `transport=TLS` in `sofia status profile internal`.

## SRTP

### Overview

SRTP (Secure RTP) encrypts the media channel. Configure SRTP at the sofia profile
level and document it per trunk via the `srtp_policy` field:

| Policy value | Meaning |
|---|---|
| `disabled` | No SRTP; plain RTP only |
| `optional` | SRTP offered; plain RTP accepted if remote does not support it |
| `required` | SRTP mandatory; calls fail if remote does not support SRTP |

### Sofia Profile Settings

```xml
<param name="rtp-secure-media" value="true"/>          <!-- enable SRTP -->
<param name="inbound-late-negotiation" value="true"/>  <!-- required for SRTP interop -->
```

To require SRTP on all calls:

```xml
<param name="rtp-secure-media" value="mandatory"/>
```

### Crypto Policy

FreeSWITCH defaults to `AES_CM_128_HMAC_SHA1_80`. To restrict to a specific
cipher suite:

```xml
<param name="rtp-secure-media-mki" value="false"/>
```

Carrier interop may require specific cipher suites. Check your carrier's
SRTP requirements before setting `mandatory`.

## NAT Traversal

### IP Address Settings

For deployments behind NAT, set the public IP addresses in the FreeSWITCH vars
or sofia profile:

```xml
<!-- In vars.xml -->
<X-PRE-PROCESS cmd="set" data="external_sip_ip=auto-nat"/>
<X-PRE-PROCESS cmd="set" data="external_rtp_ip=auto-nat"/>
```

Replace `auto-nat` with your public IP for stable deployments:

```xml
<X-PRE-PROCESS cmd="set" data="external_sip_ip=203.0.113.10"/>
<X-PRE-PROCESS cmd="set" data="external_rtp_ip=203.0.113.10"/>
```

For deployments with a public IPv4 reachable directly:

```xml
<param name="ext-rtp-ip" value="$${external_rtp_ip}"/>
<param name="ext-sip-ip" value="$${external_sip_ip}"/>
```

### Local Network ACL

Classify the internal network to avoid unnecessary NAT translation for local
traffic:

```xml
<!-- In autoload_configs/acl.conf.xml -->
<list name="localnet.auto" default="deny">
  <node type="allow" cidr="192.168.0.0/16"/>
  <node type="allow" cidr="10.0.0.0/8"/>
  <node type="allow" cidr="172.16.0.0/12"/>
</list>
```

Reference in the sofia profile:

```xml
<param name="local-network-acl" value="localnet.auto"/>
```

### RTP Port Range

Configure FreeSWITCH's RTP port range to a predictable range so firewall rules
can be precise:

```xml
<!-- In vars.xml -->
<X-PRE-PROCESS cmd="set" data="rtp_start_port=16384"/>
<X-PRE-PROCESS cmd="set" data="rtp_end_port=32768"/>
```

Open only this range at the firewall. See `docs/ops/firewall-rules.md`.

### STUN / TURN

For deployments where the public IP is dynamic or symmetric NAT causes issues,
configure STUN in the sofia profile:

```xml
<param name="stun-enabled" value="true"/>
<param name="stun-auto-disable" value="true"/>
```

TURN is not natively supported by FreeSWITCH. For complex NAT topologies,
consider a SBC (Session Border Controller) in front of FreeSWITCH.

### NAT Hairpin

If SIP clients on the internal network must reach FreeSWITCH through its external
IP (hairpin NAT), ensure your router or firewall supports NAT loopback. Alternatively,
configure split-horizon DNS so internal clients resolve `freeswitch.example.com` to
the internal IP.

## Environment Variables

The following env vars are read by `scripts/check-production-network-config.mjs`
to confirm NAT and TLS configuration has been addressed. They are not wired into
the API or Go agent; they are operator declarations.

| Variable | Purpose |
|---|---|
| `FREESWITCH_EXTERNAL_SIP_IP` | Public SIP IP or `auto-nat`. Set when behind NAT. |
| `FREESWITCH_EXTERNAL_RTP_IP` | Public RTP IP or `auto-nat`. Set when behind NAT. |
| `FREESWITCH_RTP_PORT_MIN` | Lower bound of RTP port range (e.g. 16384). |
| `FREESWITCH_RTP_PORT_MAX` | Upper bound of RTP port range (e.g. 32768). |
| `SIP_TLS_ENABLED` | Set to `true` when TLS profile is active in production. |
| `SRTP_POLICY` | Document default SRTP policy: `disabled`, `optional`, or `required`. |

## Evidence Template

See `docs/ops/templates/sip-tls-srtp-nat-evidence-template.json` for the
evidence JSON required for release promotion. Validate with:

```sh
pnpm check:sip-tls-srtp-nat-evidence -- --evidence=<path>
```

## Related Documents

- `docs/ops/firewall-rules.md` — port exposure rules
- `docs/ops/network-hardening.md` — full hardening checklist
- `docs/ops/production-deployment.md` — deployment prerequisites and env vars
