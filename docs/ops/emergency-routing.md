# Emergency Routing Safeguards and E911 Guidance

Last updated: 2026-06-04.

This document defines the emergency-routing posture for `manageCallAI`,
identifies what the product owns, and marks what is explicitly operator and
carrier responsibility. It closes the vague emergency-handling assumptions that
would otherwise block a production-readiness claim in US-facing deployments.

---

## 1. Product responsibilities (what the platform enforces)

### 1.1 Global non-bypassable emergency number block

The following numbers are blocked at the API layer for all outbound calls,
regardless of tenant policy, outbound route configuration, or capability level:

| Number | Market |
|--------|--------|
| `000`  | Australia / New Zealand |
| `110`  | China (police / fire) |
| `112`  | GSM universal / European Union |
| `118`  | Italy (medical) |
| `119`  | South Korea |
| `911`  | North America (US, Canada, Mexico) |
| `999`  | United Kingdom / Commonwealth |

**This block is enforced at three independent layers:**

1. **Fraud service** (`apps/api/src/modules/fraud/fraud.service.ts`) — evaluated
   before any tenant policy, as step 1 in the fraud-check evaluation order.
2. **Outbound-call service** (`apps/api/src/modules/runtime/outbound-call.service.ts`)
   — validated directly at outbound call creation.
3. **Centralized constants** (`apps/api/src/modules/shared/emergency-constants.ts`)
   — single source of truth imported by all enforcement points.

No tenant configuration, admin role, or API key capability can bypass this
block. The block is non-bypassable by design.

### 1.2 Feature-code emergency collision detection

When an operator creates or validates a feature code, the API checks whether
the code (or its star/hash-stripped form) would shadow a globally blocked
emergency number. If so, the API returns a validation error:

```
Feature code 911 shadows an emergency number and cannot be used
```

This prevents a FreeSWITCH dialplan feature code from intercepting a user
dialling an emergency number.

### 1.3 Fraud policy evaluation order

The global emergency block is always evaluated as step 1, before:

1. Global emergency block ← **always first, non-bypassable**
2. Global premium-rate block
3. Tenant premium-rate blocklist
4. Tenant high-risk blocklist
5. Country / area code allowlists
6. Rate caps (calls per hour / per day)

This ordering guarantee means a tenant policy cannot accidentally or
deliberately route around the emergency block.

---

## 2. Operator responsibilities (what the platform cannot own)

### 2.1 E911 geo-routing and PSAP connectivity

`manageCallAI` is a control-plane PBX product. The platform does not:

- Provide PSAP (Public Safety Answering Point) connectivity
- Perform automatic location identification (ALI) for 911 callers
- Register DID-to-civic-address mappings with the national ALI database
- Guarantee that a 911 call reaches the correct local dispatch center
- Accept liability for E911 compliance under FCC 911 Reliability orders

These are **operator and carrier responsibilities**. Operators deploying
`manageCallAI` for any US-facing telephony must:

1. **Provision a nomadic or fixed E911 service** with their SIP carrier.
   Examples: Bandwidth Emergency Services, West's VoIP 911, Intrado ERS.
2. **Register each DID with a civic address** in the carrier's E911 database.
3. **Test E911 callback numbers** before go-live using carrier test procedures
   (not live 911 calls).
4. **Notify users** of any E911 limitations in nomadic/remote deployments per
   applicable regulations.

### 2.2 Non-US emergency routing

Emergency number routing outside North America is market-specific. Operators
must:

- Confirm which emergency numbers their carrier routes for the deployed market.
- Verify that the carrier's SIP trunk is configured to pass emergency calls
  without re-writing the destination.
- Test with carrier-provided test procedures before go-live.

### 2.3 FreeSWITCH dialplan passthrough

`manageCallAI` manages outbound routing through its control plane. If an
operator configures an outbound route, the route's destination prefix logic
and trunk selection are applied after the API-level emergency block. The
product does not inject emergency-specific dialplan extensions; this remains
the operator's dialplan design responsibility.

For a recommended approach, ask your SIP carrier for their emergency routing
dialplan snippet and apply it at the FreeSWITCH level outside of the
`manageCallAI` outbound-route model.

---

## 3. Configuration guidance

### 3.1 Emergency-safe outbound route design

Do not include emergency number prefixes in any outbound route's
`allowed_destination_prefixes`. The API-level block prevents emergency calls
from dispatching, but route design should reflect the intent:

```json
{
  "name": "PSTN via primary trunk",
  "allowed_destination_prefixes": ["+1"],
  "blocked_destination_prefixes": [],
  "trunk_id": "<carrier-trunk-uuid>"
}
```

Do not create outbound routes with names or comments suggesting they handle
emergency calls. Emergency routing belongs to the carrier/PSAP layer, not to
the `manageCallAI` outbound-route model.

### 3.2 Feature code safe zone

Keep all feature codes outside the emergency number space. Prefer feature
codes in ranges such as `*1xx` or `#2xx` that do not collide with any
well-known emergency number pattern. The API enforces this automatically, but
operator design should make it explicit in the feature-code naming plan.

### 3.3 Tenant outbound fraud policy

Set a conservative default fraud policy for all production tenants:

- `deny_international_default: true` unless the tenant requires international
  outbound
- `country_allowlist`: restrict to the markets actually served
- `premium_rate_blocklist`: include `+1900`, `1900` and any market-specific
  premium prefixes

This does not replace E911 handling but reduces the blast radius of a
misconfigured route.

---

## 4. Testing recommendations

### 4.1 Emergency block smoke test (pre-go-live)

Verify the API rejects emergency destinations at every layer:

```bash
# Attempt an outbound call to 911 — expect 422 or equivalent rejection
curl -X POST http://localhost:3000/api/v1/outbound-calls \
  -H "Authorization: Bearer <tenant-token>" \
  -H "Content-Type: application/json" \
  -d '{"destination": "911", "caller_id": "+15551234567"}'
# Expected: 422 Unprocessable Entity, reason: emergency_number_blocked
```

```bash
# Attempt to create a feature code 911 — expect 422 conflict
curl -X POST http://localhost:3000/api/v1/feature-codes \
  -H "Authorization: Bearer <tenant-token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "911", "name": "test", "action_type": "voicemail"}'
# Expected: 409 Conflict, reason: emergency_number_collision
```

### 4.2 E911 carrier test (operator responsibility)

Do not use live 911 to verify E911 connectivity. Use your carrier's provided
E911 test procedures:

- **Bandwidth**: Use `+1 (933) 911-XXXX` test numbers per Bandwidth's E911
  test guide.
- **Twilio**: Use their Emergency Calling test simulator in the console.
- **Other carriers**: Contact your carrier for their E911 test numbers and
  procedures before go-live.

### 4.3 Annual verification

Re-verify the emergency block and carrier E911 test annually or after any
significant network topology change. Document results in an evidence record
under `docs/ops/`.

---

## 5. Compliance boundaries

### 5.1 FCC Kari's Law and RAY BAUM's Act (US)

`manageCallAI` deployments serving US users are subject to:

- **Kari's Law** (2018): Requires direct dialling of 911 without prefix codes.
  The platform does not insert prefix requirements, so Kari's Law compliance
  at the PBX layer is met by default.
- **RAY BAUM's Act** (2021): Requires dispatchable location information to be
  passed to PSAP for multi-line telephone systems (MLTS). This is a carrier
  and ALI registration responsibility, not a platform responsibility.

Operators must confirm compliance with their legal counsel and E911 carrier
for each deployment.

### 5.2 Non-US markets

Emergency regulations vary by market. Operators are responsible for
confirming applicable requirements with their carrier and legal counsel
before deploying in any regulated market.

---

## 6. Posture statement

> **manageCallAI blocks all globally well-known emergency numbers at the API
> and fraud-service layer with no bypass path. The platform does not provide
> E911 geo-routing, PSAP connectivity, or ALI registration. US-facing
> deployments must provision a dedicated E911 service through their SIP
> carrier and register all DIDs with civic addresses before accepting 911
> calls. This is explicit operator and carrier responsibility.**

This posture is documented here so that no production-readiness review or
sales claim can rely on vague emergency handling assumptions.
