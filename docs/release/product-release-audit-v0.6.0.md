# Product Release Audit — v0.6.0

Audit date: 2026-06-05

Audited commit: `a840863` (production evidence commit on `main`)  
Release tag: `v0.6.0`  
Auditor: Fatih Kucukpetek, maintainer

Evidence: `docs/release/release-evidence-v0.6.0.json`

---

## Release stage decision

**Production release — v0.6 AI-native differentiation.**

All four v0.6 bucket issues shipped and evidenced. All Category A gates pass.
Category B gates are inherited under the evidence inheritance policy
(`docs/release/evidence-inheritance-policy.md`). The inheritance is valid
because v0.6 made no changes to call-path, auth, deployment, or schema.

---

## Feature completeness

### v0.6 AI operator workflows (all four shipped)

| Issue | Feature | Status | Evidence |
|-------|---------|--------|----------|
| #233 | AI call failure explanation | Shipped | 23 unit + 6 integration + 7 web tests. PR #246. |
| #234 | AI route and change risk analysis | Shipped | 23 unit + 7 integration + 8 web tests. PR #242. |
| #235 | AI recording/voicemail summary review | Shipped | Integration + web tests. PR #243. |
| #236 | Natural-language telecom reporting | Shipped | 27 unit + 5 integration + 14 web tests. PR #245. |

All four features are:
- read-only (no state mutations)
- capability-gated at `tenant_operator` level and above
- bounded to API-owned records (no external LLM calls, no raw SQL)
- fail-closed (404 or `unavailable` status for missing/unsupported inputs)
- fully covered by unit and integration tests

### Prior release features (v0.3–v0.5, all still present)

| Release | Features |
|---------|----------|
| v0.5.0 | End-user self-service portal, audit log, data export, carrier health, outbound route draft/publish lifecycle, parking/conference active-call safety |
| v0.4.0 | SIP trunk/gateway operations UI, feature codes, parking lots, conference rooms, carrier test workflow, CDR reporting, emergency routing safeguards |
| v0.3.x | Full PBX completeness layer, production deployment packaging, FreeSWITCH runtime smoke gate, all production evidence gates |

---

## Architecture compliance

| Rule | Compliance |
|------|-----------|
| PostgreSQL is source of truth for desired state | Pass — v0.6 reads from existing tables, writes nothing |
| API owns lifecycle, validation, simulation, publish | Pass — v0.6 adds read-only advisory endpoints only |
| FreeSWITCH remains runtime-only | Pass — no new FreeSWITCH interaction in v0.6 |
| No raw ESL/XML/shell for AI or workflows | Pass — all v0.6 features are pure TypeScript pattern matching on stored records |
| Bounded query compilation, not raw SQL | Pass — NL reporting uses parameterized filters only |
| External AI is assistive, not autonomous | Pass — no external LLM calls; deterministic grounding only |

---

## Security posture

| Area | Finding |
|------|---------|
| CodeQL | Clean — run 27028893173 |
| New privileged surfaces | None — all v0.6 endpoints are read-only |
| Cross-tenant isolation | Pass — all repositories scope by tenant_id |
| Capability gating | Pass — three new capabilities added and tested |
| SQL injection | Pass — NL reporting uses parameterized queries; user input never reaches SQL text |
| Evidence inheritance scope | Valid — no auth, call-path, or deployment changes |

---

## Gate summary

### Category A (must re-run per release) — all pass

| Gate | Run | Result |
|------|-----|--------|
| CI build + test | 27028893165 | Pass |
| CodeQL | 27028893173 | Pass |
| Coverage | 27028893142 | Pass |
| Docker images | 27028893166 | Pass |
| FreeSWITCH smoke | 27028911635 | Pass |
| API capability alignment | inline | Pass |
| OpenAPI/SDK drift | inline | Pass |
| Webhook coverage | inline | Pass |

### Category B (inherited) — all valid

| Gate | Inherited from | Validity |
|------|---------------|---------|
| Helm lint | v0.5.0-rc.1 | Valid — no chart changes |
| docker-compose smoke | v0.5.0 | Valid — no deployment changes |
| Rotation rehearsal | v0.5.0 | Valid — no auth changes |
| Soak / SLO | v0.3.0 | Valid — no call-path changes. Age: 3 versions. **Must re-run at v0.7.0.** |
| Carrier interop | v0.3.0 | Valid — no SIP/gateway changes. Age: 3 versions. **Must re-run at v0.7.0.** |
| Restore rehearsal | v0.5.0 | Valid — no new migrations |

---

## Distribution readiness

| Path | Status |
|------|--------|
| GitHub release published | Yes — https://github.com/gokbilge/manageCallAI/releases/tag/v0.6.0 |
| GHCR images built | Yes — docker-images run 27028893166 |
| GHCR packages public | Pending — operator must set visibility to Public |
| docker compose up path | Functional once packages are public |
| install.sh | Unchanged from v0.5.0 — functional |
| Helm chart | Unchanged from v0.5.0 — functional |

**Required operator action before external distribution:**  
`GitHub → Profile → Packages → managecallai-* → Change visibility → Public`

---

## Upgrade path from v0.5.0

1. Pull new image: `docker pull ghcr.io/gokbilge/managecallai-api:v0.6.0`
2. Update `MANAGECALLAI_IMAGE_TAG=v0.6.0` in `.env.production`
3. `docker compose -f docker-compose.prod.yml up -d`
4. No `pnpm db:migrate` required — no new migrations in v0.6.0

**Zero-downtime upgrade:** v0.6.0 is a drop-in image replacement.

---

## Known gaps and scheduled actions

| Item | Scheduled for |
|------|-------------|
| GHCR packages made public | Operator action — no deadline |
| Full carrier interop re-run | v0.7.0 (age limit reached) |
| Full soak/SLO re-run | v0.7.0 (age limit reached) |
| Live rotation rehearsal | v0.7.0 (minor version boundary) |

---

## Operator signoff

| Field | Value |
|-------|-------|
| Name | Fatih Kucukpetek |
| Role | Maintainer |
| Date | 2026-06-05 |
| Notes | v0.6.0 production audit complete. All four AI operator workflow features delivered and evidenced. All Category A gates pass. Category B evidence inherited with valid scope and documented in evidence-inheritance-policy.md. Distribution pending GHCR package visibility change. |
