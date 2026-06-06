# Product Release Audit

This document is the current production release audit. It is updated in-place
for each new production release. Prior versions are preserved in git history.

**How to update:** At each release, update the header fields, feature table,
gate summary, and distribution table. Leave the structure intact — it doubles
as a template. Archive the old state in git history; do not create version-
suffixed copies of this file.

---

## Current release

| Field | Value |
|-------|-------|
| Version | v0.6.0 |
| Date | 2026-06-05 |
| Commit | `a840863` |
| Classification | Production release — AI-native differentiation |
| Evidence | `docs/release/release-evidence-v0.6.0.json` |
| Auditor | Fatih Kucukpetek, maintainer |

---

## Release stage decision

**Production release.**

All Category A gates pass on the RC commit. Category B gates are inherited where
the tested code path was unchanged, as documented in
`docs/release/evidence-inheritance-policy.md`.

---

## Feature completeness

| Release | Feature area | Status |
|---------|-------------|--------|
| v0.6.0 | AI call failure explanation (#233) | Shipped — 23 unit + 6 integration + 7 web tests |
| v0.6.0 | AI route/change risk analysis (#234) | Shipped — 23 unit + 7 integration + 8 web tests |
| v0.6.0 | AI recording/voicemail summary review (#235) | Shipped — integration + web tests |
| v0.6.0 | Natural-language telecom reporting (#236) | Shipped — 27 unit + 5 integration + 14 web tests |
| v0.5.0 | End-user self-service portal, audit log, data export, carrier health, outbound route draft lifecycle | Shipped |
| v0.4.0 | SIP trunk UI, feature codes, parking, conferencing, carrier test workflow, emergency routing | Shipped |
| v0.3.x | Full PBX completeness layer, production deployment packaging, all initial production gates | Shipped |

---

## Architecture compliance

| Rule | Status |
|------|--------|
| PostgreSQL is source of truth for desired state | Pass |
| API owns lifecycle, validation, simulation, publish | Pass |
| FreeSWITCH remains runtime-only | Pass |
| No raw ESL/XML/shell for AI or workflows | Pass |
| Natural-language queries compile to bounded filters, not raw SQL | Pass |
| AI is assistive and advisory, not autonomous | Pass |

---

## Security posture

| Area | Result |
|------|--------|
| CodeQL scan | Clean — run 27028893173 |
| New privileged surfaces | None |
| Cross-tenant isolation | Pass — all queries scope by tenant_id |
| Capability gating | Pass — three new capabilities added and tested |
| SQL injection surface (NL reporting) | Pass — parameterized filters, no raw SQL |
| Evidence inheritance scope | Valid — see inheritance policy |

---

## Gate summary

### Category A — runs every release

| Gate | Run ID | Result |
|------|--------|--------|
| CI build + test | 27028893165 | Pass |
| CodeQL | 27028893173 | Pass |
| Coverage | 27028893142 | Pass |
| Docker image build | 27028893166 | Pass |
| FreeSWITCH smoke | 27028911635 | Pass |
| API capability alignment | inline | Pass |
| OpenAPI/SDK drift | inline | Pass |
| Webhook payload coverage | inline | Pass |

### Category B — inherited (see `evidence-inheritance-policy.md`)

| Gate | Inherited from | Condition |
|------|---------------|-----------|
| Helm lint | v0.5.0-rc.1 | No chart changes |
| docker-compose smoke | v0.5.0 | No deployment changes |
| Rotation rehearsal | v0.5.0 | No auth-path changes |
| Soak / SLO | v0.3.0 | No call-path changes. Age: 3 versions. **Re-run at v0.7.0.** |
| Carrier interop | v0.3.0 | No SIP/gateway changes. Age: 3 versions. **Re-run at v0.7.0.** |
| Restore rehearsal | v0.5.0 | No new migrations |

---

## Distribution readiness

| Delivery path | Status |
|---------------|--------|
| GitHub release published | Yes — https://github.com/gokbilge/manageCallAI/releases/tag/v0.6.0 |
| GHCR images built | Yes — run 27030079609 (tag v0.6.0) |
| GHCR packages public | **Pending** — see operator action below |
| `docker compose up` from public images | Blocked on packages being public |
| `install.sh` version default | Updated to v0.6.0 |
| Clean external install test | Pending — run after packages are made public |

**Required operator action:**

```
GitHub → Profile (gokbilge) → Packages → each managecallai-* package
→ Package settings → Change package visibility → Public
```

Packages to make public: `managecallai-api`, `managecallai-web`,
`managecallai-mcp`, `managecallai-worker`, `managecallai-freeswitch-agent`.

---

## Upgrade path from previous release

| Step | v0.5.0 → v0.6.0 |
|------|----------------|
| DB migration | Not required — no new migrations |
| Image update | `MANAGECALLAI_IMAGE_TAG=v0.6.0` in `.env.production` |
| Restart | `docker compose -f docker-compose.prod.yml up -d` |
| Downtime | Zero — drop-in image replacement |

---

## Known gaps and scheduled actions

| Item | Due | Owner |
|------|-----|-------|
| GHCR packages made public | Before external distribution | Operator |
| Clean external install test | After packages are public | Maintainer |
| Full carrier interop re-run | v0.7.0 (age limit) | Maintainer |
| Full soak/SLO re-run | v0.7.0 (age limit) | Maintainer |
| Live rotation rehearsal | v0.7.0 (minor boundary) | Maintainer |

## Migration and Adoption Toolkit

manageCallAI will support migration through a staged, evidence-based process:
source discovery, compatibility analysis, draft import, validation, simulation,
operator approval, cutover checklist, runtime smoke, and rollback evidence.

The importer must not auto-publish live objects or execute source custom logic.

---

## Operator signoff

| Field | Value |
|-------|-------|
| Name | Fatih Kucukpetek |
| Role | Maintainer |
| Date | 2026-06-05 |
| Notes | v0.6.0 audit complete. All Category A gates pass. Category B inherited with valid scope. Distribution pending GHCR package visibility change. |
