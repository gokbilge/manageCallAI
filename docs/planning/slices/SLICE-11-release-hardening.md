# SLICE-11 Release Hardening

## Goal

Turn the accumulated slices into a release-ready product.

## Status

**CLOSED** — 2026-05-29

- ✓ `pnpm audit` — no known vulnerabilities
- ✓ `pnpm build && pnpm lint && pnpm test` — all clean (182 API, 28 web, 15 MCP)
- ✓ `.env.example` updated with all vars through SLICE-14
- ✓ `apps/mcp` lint script added — now covered by `pnpm -r lint` in CI
- ✓ `scripts/mvp-smoke.ps1` extended with full IVR lifecycle path (create → validate → simulate → publish)
- ✓ `docs/development/release-runbook.md` — fresh install, upgrade, rollback, MCP/n8n setup
- ✓ `docs/audit/audits/2026-05-29-pre-release.md` — 7 findings, all accepted or resolved, PASS

## Scope

- final smoke tests
- release runbooks
- dependency and vulnerability review
- CI/CD gates for release
- deployment docs
- security and secrets review
- supportable demo path

## Depends On

- `SLICE-02`
- `SLICE-07`
- `SLICE-08`
- `SLICE-09`
- `SLICE-10`

## Parallel With

- small polish items only

## Unblocks

- first public product release

## Exit Criteria

- release checklist exists and passes
- live demo path is documented and reproducible
- docs are coherent
- major vulnerabilities are understood or resolved
- product boundaries are explicit

## Out Of Scope

- broad enterprise scaling claims beyond what is proven
