# Audit Guide — manageCallAI

How agents and contributors should conduct, document, and resolve project audits.

## Purpose

Audits keep the codebase honest at checkpoints — after a feature milestone, before
a release candidate, or when something feels off. They are not code reviews of a
single PR; they survey the whole working slice.

## When to run an audit

- After completing a vertical feature slice (auth, encryption, new resource).
- Before declaring a milestone "done" and moving to the next step.
- After multiple rapid sessions where drift may have accumulated.
- When a reviewer or user flags something unexpected in the running system.

## Scope

An audit covers all of:

| Area | What to check |
|------|---------------|
| **Schema vs. code** | Every column the code reads or writes exists in the migration. No `SELECT *` or `RETURNING *` in production queries. Column types match TypeScript types. |
| **Security** | Auth middleware enforces on every protected route. No plaintext secrets in DB, logs, or responses. Tenant isolation applies to every mutation. Runtime tokens travel via header, not query param, in production paths. |
| **Tests** | Every happy path has a test. Every security boundary (auth, tenant isolation) has a test. Tests use the real token/key values, not hardcoded strings. |
| **Consistency** | API contract matches what the code actually does. OpenAPI schema matches request/response shapes. Docs reflect current field names. |
| **Dependencies between apps** | Worker and MCP server request shapes match the API they call. Breaking API changes are caught here. |
| **Infra** | docker-compose passes all required env vars. CI sets all required env vars. `.env.example` is complete. |
| **Operational** | No `console.log` in production source. No TODO/FIXME in source (move to audit tracker instead). No `dist/` tracked in git. |

## How to run an audit (agent steps)

1. Read recent commit history (`git log --oneline -20`).
2. Run `pnpm build && pnpm lint && pnpm test` and record the result.
3. Read every production `.ts` file in `apps/api/src` — service, repository, controller, crypto, config.
4. Read every other app that calls the API — worker, MCP server, freeswitch-agent.
5. Run `node db/migrate.mjs --status` to confirm schema is applied.
6. Check `docker-compose.yml` and `.github/workflows/ci.yml` env vars against `config/env.ts`.
7. Grep for `SELECT \*`, `RETURNING \*`, `console\.`, `TODO`, `FIXME`, `sip_password[^_]`.
8. Verify every route that should require auth has a preHandler; spot-check with a curl with no token.
9. Produce a findings list and write it to `docs/audit/audits/<YYYY-MM-DD>-<slug>.md`.
10. For each finding that remains `open`, `in-progress`, or `accepted`, create or
    update a GitHub issue before closing the audit session.

## Audit document format

Each audit lives in `docs/audit/audits/` named `YYYY-MM-DD-<slug>.md`.

```markdown
# Audit — <slug> — <YYYY-MM-DD>

**Commit:** <sha>
**Scope:** <what was reviewed>
**Result:** PASS | PASS WITH FINDINGS | FAIL

## Findings

### <ID>: <short title>

- **Status:** open | in-progress | done
- **Severity:** high | medium | low | info
- **Location:** `path/to/file.ts:line`
- **Finding:** What is wrong and why it matters.
- **Fix:** Concrete action required.
- **Resolved:** <!-- commit sha when fixed -->
```

Finding IDs use the format `AUD-YYYY-MM-DD-NNN` (three-digit sequence within the audit).

## GitHub issue tracking

Audit records are the canonical evidence trail, but GitHub issues are the
execution tracker for unresolved work.

For every audit finding that is not resolved in the same session:

1. Search existing open issues for the audit finding ID or same underlying risk.
2. If no issue exists, create a GitHub issue using the most specific issue form.
3. Include the audit finding ID, audit file path, affected files, severity, risk,
   and concrete fix direction in the issue body.
4. Add labels for `area:*`, `type:*`, `priority:*`, and `risk:*`.
5. Assign the appropriate milestone or Project field when the finding maps to a
   planned slice or release gate.
6. Add the issue URL back to the audit finding under an `Issue:` line.

Do not create duplicate issues for the same finding. If an issue already exists,
comment with the new audit context and link the audit file.

Audit-created issues, comments, commits, pushes, and pull requests must use the
repository maintainer or contributor identity configured in git and GitHub. Do
not add `Codex`, `Claude`, another AI-agent name, or generated-by footers to git
authors, commit messages, PR text, issue comments, or audit issue bodies.

## Resolving findings

When a finding is fixed:

1. Update the finding's `Status` to `done` and add the commit SHA to `Resolved`.
2. Close the linked GitHub issue, or comment on the issue with the fix commit if
   the issue contains more remaining scope.
3. Do not delete findings — the history of what was found and fixed is valuable.
4. If a finding is accepted as a known limitation rather than fixed, set `Status` to
   `accepted` and add a one-line rationale.

## Linking to this guide

- `CLAUDE.md` and `AGENTS.md` link here so any agent session can find the process.
- The audit index is `docs/audit/audits/` — list files there to see past audits.
