# SLICE-58 Production SDK, MCP, n8n, And Release Packaging

## Priority

P2 - production release gate

## Status

PLANNED

## Goal

Package the developer and automation surfaces for production use: versioned SDK,
MCP setup and capability matrix, n8n workflows, OpenAPI artifacts, release notes,
upgrade notes, and compatibility policy.

## Context

The API is the safety boundary, but production users also interact through SDKs,
MCP tools, and n8n workflows. These surfaces must be versioned, documented,
drift-checked, and narrower than REST where applicable. Production releases need
clear compatibility expectations and installable artifacts.

## Depends On

- `SLICE-38-mcp-contract-alignment.md`
- `SLICE-49-public-alpha-readiness.md`
- `SLICE-51-release-grade-product-coverage-and-runbooks.md`

## Scope

- Define SDK versioning and npm publish process.
- Generate and publish or package OpenAPI and SDK artifacts.
- Verify MCP setup docs, capability matrix, risk labels, and schema drift checks.
- Verify n8n workflow examples import and run against documented endpoints.
- Add release notes template with breaking changes, migration notes, runtime
  compatibility, FreeSWITCH version, database migration notes, and known
  limitations.
- Define compatibility policy for API, SDK, MCP tools, webhook payloads, and
  FreeSWITCH runtime contracts.
- Add package provenance/signing guidance where practical.

## Acceptance Criteria

- SDK can be built, tested, versioned, and published or packaged reproducibly.
- MCP docs and capability matrix match tool schemas.
- n8n examples are usable from docs alone.
- OpenAPI artifacts are attached or documented for every production release.
- Release notes include migration, runtime compatibility, and known limitations.
