# Open Release Blockers

This document lists all open beta and production blockers, grouped by
milestone. Last updated: 2026-06-02.

See the [GitHub issue tracker](https://github.com/gokbilge/manageCallAI/issues)
for the authoritative and up-to-date list.

---

## Current Release Stage

**Public Alpha Ready** — `v0.2.0-alpha` tagged 2026-06-02.

- Internal alpha: ✅ Ready
- Public alpha: ✅ Ready (`v0.2.0-alpha`)
- Public beta: ⛔ Not ready — 6 blockers (#131–135, #141)
- Production: ⛔ Not ready — 5 blockers (#136–140)

---

## Public Alpha — Milestone M6 ✅ All closed

| # | Title | Priority | Status |
|---|---|---|---|
| [#130](https://github.com/gokbilge/manageCallAI/issues/130) | Clean-clone public alpha verification | P0 | ✅ Closed |

---

## Public Beta

| # | Title | Priority | Status |
|---|---|---|---|
| [#131](https://github.com/gokbilge/manageCallAI/issues/131) | First usable observability HUD beta release surface | P0 | Open |
| [#132](https://github.com/gokbilge/manageCallAI/issues/132) | Verify webhook signing, replay protection, and idempotency | P0 | Open |
| [#133](https://github.com/gokbilge/manageCallAI/issues/133) | Verify n8n example workflows end-to-end | P0 | Open |
| [#134](https://github.com/gokbilge/manageCallAI/issues/134) | Verify MCP setup and capability matrix end-to-end | P0 | Open |
| [#135](https://github.com/gokbilge/manageCallAI/issues/135) | SDK versioning and publishing readiness | P0 | Open |
| [#141](https://github.com/gokbilge/manageCallAI/issues/141) | Coverage threshold improvement or documented beta exceptions | P0 | Open |

---

## Production Release

| # | Title | Priority | Status |
|---|---|---|---|
| [#136](https://github.com/gokbilge/manageCallAI/issues/136) | Implement retention API endpoints and legal hold management | P1 | Open |
| [#137](https://github.com/gokbilge/manageCallAI/issues/137) | Run FreeSWITCH smoke gate on release branch and produce RC evidence | P1 | Open |
| [#138](https://github.com/gokbilge/manageCallAI/issues/138) | Live carrier SIP trunk interoperability certification | P1 | Open |
| [#139](https://github.com/gokbilge/manageCallAI/issues/139) | Multi-instance rate limiting live evidence | P1 | Open |
| [#140](https://github.com/gokbilge/manageCallAI/issues/140) | Upgrade and migration rehearsal before production | P1 | Open |

---

## Intentionally Not Included (Already Closed)

The following issues were closed in June 2026 with real evidence:

| # | Title | Evidence |
|---|---|---|
| #90 | Self-hosted FreeSWITCH runner provisioned | Smoke run 26803056139 |
| #91 | Tenant isolation test gaps | 41/41 rbac-matrix tests (PR #125) |
| #92 | SIP TLS/SRTP/NAT evidence | Smoke run 26803056139 artifacts |
| #93 | FreeSWITCH hardening evidence | Smoke run 26803056139 artifacts |
| #94 | Secret/rotation rehearsal evidence | PR #124 |
| #98 | Restore rehearsal evidence | PR #116 |
| #99 | Backup retention policy | docs/ops/backup-retention-policy.json |
| #100 | Soak/SLO evidence | PR #116 (1800s, 0% failure) |
| #101 | Carrier interop evidence | docs/ops/carrier-interop-evidence-2026-06-02.json (lab, 3/8 passed) |
| #102 | Retention policy implementation | Migration 0038/0043, worker module |
| #103 | Release evidence bundle manifest | docs/release/release-evidence-v0.1.0.json |

---

## Notes

- Items marked **"scripted but not evidenced"** in
  `docs/release/public-alpha-readiness.md` are reflected here.
- Do not treat check-config mode output as production evidence.
- The FreeSWITCH smoke run (26803056139) was on a feature branch, not a
  `release/**` or `rc/**` branch. Issue #137 tracks the required RC smoke run.
- Carrier interop evidence is lab-only (#101 closed with documented
  exceptions). Issue #138 tracks the live carrier requirement.
