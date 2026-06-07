# GitHub Workflow

## Purpose

This repository uses GitHub as the coordination system for code review,
security gates, audit findings, and release work. The normal workflow is not a
direct commit and push to `main`.

## Protected Main

`main` is protected. Changes should move through:

1. Create a focused branch from `main`.
2. Commit with the configured maintainer or contributor git identity.
3. Push the branch.
4. Open a draft pull request.
5. Wait for CI, CodeQL, Docker checks, and any configured coverage/security
   checks.
6. Request or wait for CODEOWNERS review.
7. Mark the PR ready only when the change is complete and checks are green.
8. Merge through GitHub after required review and status checks pass.

Direct pushes to `main` are reserved for emergency repository administration and
should not be the standard path.

## Identity

Commits, PRs, issue comments, audit issue bodies, and release notes must use the
configured maintainer or contributor identity. Do not add AI-agent attribution,
generated-by footers, or assistant names to commit authors, commit messages, PR
text, issue comments, or audit records.

## Pull Requests

PRs should include:

- concise summary
- risk notes for runtime, security, tenant isolation, or database changes
- tests or validation performed
- linked issues for fixes or audit findings

Documentation-only changes still use PRs because branch protection and CI prove
that generated contracts, checks, and security gates remain coherent.

## Planning And Documentation Issue Hygiene

When architecture, planning, or migration docs change issue scope materially:

- update umbrella and child issue bodies so they match the current design
- correct stale issue-range references instead of letting docs and issues drift
- record intentional matrix-only or roadmap-only items explicitly so later
  slices do not imply missing implementation work

## Audit Findings

Open audit findings must be mirrored into GitHub Issues. The audit file is the
evidence trail; the issue is the execution tracker.

When creating an audit issue:

- include the audit finding ID
- link the audit file path
- describe severity, affected files, and fix direction
- apply area, type, priority, and risk labels
- assign the relevant milestone when known

Close the issue only when the finding is fixed or explicitly accepted with a
documented rationale.
