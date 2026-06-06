# Audit - architecture-design-requirements-audit - 2026-06-06

**Commit:** `fbb542e`
**Scope:** `docs/architecture/source-of-truth.md`, `docs/architecture/overview.md`,
`docs/design/software-design.md`, `docs/design/domain-model.md`,
`docs/requirements/srs.md` reviewed against the current API/web/contracts code line.
**Result:** PASS WITH FINDINGS

## Verification

- `git log --oneline -20` - reviewed
- `pnpm build` - passed
- `pnpm lint` - passed with one existing warning in
  `apps/web/src/features/ai/incident-investigation-page.tsx:22`
- `pnpm test` - failed in `@managecallai/api` because local PostgreSQL was not
  available at `127.0.0.1:5432`; web, MCP, worker, SDK, and other non-DB-backed
  suites passed
- `node db/migrate.mjs --status` - environment-blocked locally (`Migration failed`)
- `docker-compose.yml`, `.github/workflows/ci.yml`, and `apps/api/src/config/env.ts`
  were spot-checked for env alignment
- grep checks for `SELECT *`, `RETURNING *`, `console.`, `TODO`, `FIXME`,
  `sip_password[^_]` were run; hits were test files, explicit CLI scripts, or
  known logging/bootstrap code paths, not new architecture-doc findings

## Findings

### AUD-2026-06-06-001: Source-of-truth release posture is stale

- **Status:** open
- **Severity:** medium
- **Location:** `docs/architecture/source-of-truth.md:9`
- **Finding:** The canonical source-of-truth document still says the current code
  line is `v0.5.x` and production release is `v0.5.0`, but the repository code,
  package versions, and release evidence are already at `v0.6.2`. This makes the
  architecture authority contradict the current release line and weakens trust in
  the document when used as the top-level product reference.
- **Fix:** Update the release-posture paragraph to match the latest evidenced
  release and current code line, while preserving the rule that release stage must
  come from evidence documents rather than source inspection.
- **Issue:** https://github.com/gokbilge/manageCallAI/issues/342
- **Resolved:**

### AUD-2026-06-06-002: Core architecture and design docs understate the implemented product surface

- **Status:** open
- **Severity:** medium
- **Location:** `docs/architecture/source-of-truth.md:169`,
  `docs/design/software-design.md:226`,
  `apps/api/src/app.ts:101`
- **Finding:** The source-of-truth implemented-capability summary still lists the
  older baseline and omits already-registered modules such as numbering plans,
  calling policies, sites, AI recommendations, incident investigation, and
  natural-language reporting. The software-design service decomposition also marks
  several implemented services as `planned`, including `NumberingPlanService`,
  `CallingPolicyService`, `SiteService`, `CallFailureExplanationService`,
  `RouteRiskAnalysisService`, and the reporting service boundary. This creates
  avoidable drift between the design docs and the real module surface.
- **Fix:** Refresh the implemented-capability summary and service decomposition so
  implemented modules are described as current, while keeping genuinely future
  services such as trunk-group, device, and line-appearance work explicitly
  planned.
- **Issue:** https://github.com/gokbilge/manageCallAI/issues/343
- **Resolved:**

### AUD-2026-06-06-003: SRS still reads as an MVP-only specification instead of the current product line

- **Status:** open
- **Severity:** low
- **Location:** `docs/requirements/srs.md:9`,
  `docs/requirements/srs.md:17`,
  `docs/requirements/srs.md:264`,
  `apps/api/src/app.ts:101`,
  `apps/web/src/features`
- **Finding:** The SRS still frames itself as guidance for the "initial platform
  and MVP scope" and centers the product around a safe IVR/routing control plane.
  That is historically accurate, but the current code line now includes broader
  PBX, self-service, AI assistance, reporting, compliance, observability, and
  enterprise-model surfaces. As written, the SRS no longer reads like the active
  requirement baseline for the actual shipped product line.
- **Fix:** Decide whether the SRS should remain a historical MVP-spec document or
  become the active product-requirements baseline. If it remains active, widen the
  scope, functional requirement set, and acceptance framing to reflect the current
  surface and phased enterprise roadmap.
- **Issue:** https://github.com/gokbilge/manageCallAI/issues/344
- **Resolved:**
