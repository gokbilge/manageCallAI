# Release Notes Policy

This policy defines how manageCallAI version tags, changelog entries, GitHub
releases, SDK status, and release evidence stay aligned.

## Version Channels

Use semantic versioning with explicit pre-release channels until production:

| Channel | Tag pattern | Purpose |
|---|---|---|
| Internal alpha | `v0.1.0-internal-alpha.N` | Maintainer-only validation and demo-loop proof |
| Public alpha | `v0.1.0-alpha.N` | Contributor and evaluator release; not production-ready |
| Public beta | `v0.2.0-beta.N` | Runtime smoke-gated release with usable operator workflows |
| Release candidate | `v0.2.0-rc.N` | Production-candidate validation with full evidence bundle |
| Production | `v1.0.0+` | Production-supported self-hosted release |

Do not move public tags. If a release candidate fails, cut a new numbered tag.

## Required Release Notes Sections

Every GitHub release must include:

- Release classification: internal alpha, public alpha, beta, RC, or production.
- Production readiness statement.
- Upgrade notes and required migrations.
- Security fixes and known security limitations.
- Runtime/FreeSWITCH compatibility and smoke evidence status.
- Database migration and rollback considerations.
- SDK package version and publish status.
- Breaking changes.
- Known limitations.
- Links to the release checklist and evidence bundle.

## Changelog Requirements

`CHANGELOG.md` is the human-readable source for release deltas.

Before tagging:

- Move relevant `Unreleased` entries under the new version heading.
- Include issue numbers for user-visible fixes and release blockers.
- Keep known limitations accurate for the release channel.
- State whether the SDK package is generated, buildable, tested, and published.
- Do not claim production readiness without required runtime, deployment,
  backup/restore, security, and coverage evidence.

## SDK Alignment

The SDK must not be implied as published unless an npm publish dry run or actual
publish has been performed for that release.

Release notes must state one of:

- `SDK not published`: generated client is present only in the repository.
- `SDK publish dry run passed`: package metadata and artifacts were validated.
- `SDK published`: npm package name, version, and registry link are included.

## Release Dry Run

Run the standard checks from `docs/release/release-checklist.md`. At minimum:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm test
pnpm test:coverage
pnpm generate:openapi
pnpm db:migrate
pnpm db:contracts
pnpm db:constraints
pnpm check:migrations
pnpm check:mcp-schemas
pnpm check:webhook-payloads
pnpm check:api-key-capabilities
```

Beta, RC, and production releases also require the runtime evidence gates
listed in `docs/release/release-checklist.md`.
