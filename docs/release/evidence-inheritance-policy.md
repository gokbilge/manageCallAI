# Evidence Inheritance Policy

Last updated: 2026-06-05 (v0.6.0).

This document defines which release evidence may be inherited from a prior
release, which code changes invalidate prior evidence, evidence age limits,
and which gates must re-run for every release regardless of inheritance.

---

## Why inheritance exists

Some evidence gates are expensive to repeat when a release makes no changes
to the tested code path. A v0.6 release that adds advisory read-only AI
endpoints does not need to repeat a carrier interop call test that validated
FreeSWITCH trunk registration behavior in v0.3. Inheritance avoids unnecessary
cost without weakening the claim — provided the scope is explicitly stated and
the boundaries are auditable.

**Inheritance is not a shortcut.** It is a bounded claim: "the evidence from
release X remains valid for release Y because Y made no changes to the tested
scope." If that claim is false, the inheritance is invalid.

---

## Gate categories

### Category A — must re-run for every release

These gates are cheap, fast, or scope-sensitive enough that inheritance is never
appropriate.

| Gate | Rationale |
|------|-----------|
| CI build + test | Always scope-sensitive. Run time: ~6 min. |
| CodeQL security scan | Always scope-sensitive. Run time: ~2 min. |
| Code coverage | Always scope-sensitive. |
| Docker image build | Must reflect the exact release commit. |
| FreeSWITCH smoke gate | Must run on the RC branch at `rc/vX.Y.Z`. Run time: ~7 min. |
| API capability alignment check | Always scope-sensitive. |
| OpenAPI/SDK drift checks | Always scope-sensitive. |
| Webhook payload coverage | Always scope-sensitive. |

### Category B — may be inherited, scoped by code boundary

These gates test code paths that may not change between releases.

| Gate | Inheritable when | Invalidated when |
|------|-----------------|-----------------|
| Helm lint | No chart changes | Any change to `charts/` |
| docker-compose.prod.yml smoke | No deployment, env-var, or startup changes | Changes to `docker-compose.prod.yml`, startup scripts, or env var requirements |
| Rotation rehearsal | No auth middleware or JWT/token-path changes | Any change to `apps/api/src/modules/auth/`, token generation, or secret handling |
| Soak / SLO evidence | No call-path or hot-path changes | Any change to FreeSWITCH dialplan, Lua, Go agent call handling, or IVR runtime |
| Carrier interop | No SIP/media path changes | Any change to SIP trunk handling, FreeSWITCH gateway config, codec negotiation |
| Restore rehearsal | No schema migration additions | Any new DB migration |
| Rate-limit proof | No API surface or middleware changes | Any new endpoint category or rate-limit policy change |

### Category C — must re-run before major releases (0.x.0)

These gates are expensive but required when the release crosses a minor version
boundary (i.e., any `0.MINOR.0` release).

| Gate | Last run | Run at |
|------|----------|--------|
| Full carrier interop (all profiles) | v0.3.0 (2026-06-02) | Every major/minor release where SIP path changes |
| Live rotation rehearsal (not just check-config) | v0.5.0 (2026-06-05) | Every minor release |
| Production soak + SLO evidence | v0.3.0 (2026-06-03) | Every minor release where hot-path changes |

---

## Evidence age limits

| Evidence type | Maximum age | Notes |
|---------------|------------|-------|
| CI / CodeQL / coverage | Per-release (no inheritance) | Must match RC commit SHA |
| FreeSWITCH smoke | Per-release (no inheritance) | Must run on `rc/**` branch |
| Helm lint / docker-compose smoke | 1 minor version | Must have no chart/deployment changes |
| Rotation rehearsal | 1 minor version | Must have no auth-path changes |
| Soak / SLO | 2 minor versions | Must have no call-path changes |
| Carrier interop | 2 minor versions | Must have no SIP/trunk/gateway changes |
| Restore rehearsal | 1 minor version per new migration batch | Re-required for each new migration batch |

---

## Inheritance claim format

An evidence manifest that inherits a gate must use this format:

```json
"helm_lint": "Inherited from v0.5.0-rc.1. No Helm chart changes in v0.6. PASSED on enlogy@10.0.0.32."
```

Required fields:
- Which version the evidence is inherited from
- The specific condition that makes inheritance valid ("No X changes in vY")
- The original gate result ("PASSED")

Omitting any field makes the inheritance claim unverifiable and the gate must
be treated as not evidenced.

---

## What invalidates inheritance

A code change invalidates inheritance of a gate if it touches any file or
behavior in scope for that gate. Specifically:

| Change type | Gates invalidated |
|-------------|------------------|
| New DB migration | Restore rehearsal |
| Change to `apps/api/src/modules/auth/` | Rotation rehearsal |
| Change to `charts/` | Helm lint |
| Change to `docker-compose.prod.yml` or `.env.production.example` | docker-compose smoke |
| Change to Go agent call handling or FreeSWITCH dialplan | Soak/SLO, carrier interop |
| New API endpoint or rate-limit rule | Rate-limit proof |
| Any SIP trunk, gateway, or codec change | Carrier interop |

---

## Current release inheritance record

Update this section at each release. The version column is the release being
cut; the "inherited from" column is where the evidence was originally collected.

**Current release: v0.6.0**

| Gate | Inherited from | Valid because | Age (versions) |
|------|---------------|---------------|----------------|
| Helm lint | v0.5.0-rc.1 | No `charts/` changes | 1 |
| docker-compose smoke | v0.5.0 | No deployment changes | 1 |
| Rotation rehearsal | v0.5.0 | No auth-path changes | 1 |
| Soak / SLO | v0.3.0 | No call-path changes | 3 — age limit exceeded; **re-run at v0.7.0** |
| Carrier interop | v0.3.0 | No SIP/gateway changes | 3 — age limit exceeded; **re-run at v0.7.0** |
| Restore rehearsal | v0.5.0 | No new migrations | 1 |

---

## Scheduled re-runs

Gates that have reached or exceeded their age limit must be re-run at the next
release. Update this table when a gate is re-run or a new age limit is reached.

| Gate | Last run | Age at current release | Re-run required by | Status |
|------|----------|----------------------|--------------------|--------|
| Full carrier interop | v0.3.0 | 3 versions | v0.7.0 | Scheduled |
| Full soak / SLO | v0.3.0 | 3 versions | v0.7.0 | Scheduled |
| Live rotation rehearsal | v0.5.0 | 1 version | v0.7.0 | Scheduled |

---

## How to update this document for a new release

1. Change "Current release" to the new version.
2. For each Category B gate: determine whether it should be inherited or re-run.
   - If inherited: update the "inherited from" version and confirm the condition still holds.
   - If re-run: move it to the gate summary in `product-release-audit.md` as a fresh run.
3. Increment the age counter for each inherited gate.
4. Check each gate against its age limit. Add any exceeding limits to "Scheduled re-runs."
5. Remove gates from "Scheduled re-runs" once they have been re-run.
