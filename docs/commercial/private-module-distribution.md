# Private Module Distribution

Last updated: 2026-06-07.

This document describes the supported future distribution options for private
Pro and Enterprise modules.

## Distribution options

### Public core image plus mounted private modules

Operators run the public core image and mount locally installed private modules
into a known module directory.

Use when:

- the public image remains the base runtime
- private modules are delivered separately
- an operator needs explicit control over installed private packages

### Private Pro or Enterprise image

Maintainers publish a private image that bundles the public core together with
private commercial modules.

Use when:

- the official supported installation path is a curated commercial image
- maintainers want stronger control over tested combinations
- commercial support depends on certified image builds

### Private npm or GitHub Packages modules

Private packages can provide:

- API-side module registration
- worker hooks
- UI extension bundles
- commercial feature implementations

Use when:

- maintainers want package-level versioning and access control
- self-hosted operators need explicit dependency installation rights

### Private GHCR images

Private GHCR images can bundle:

- edition-specific core images
- module-enabled images
- certified builds tied to support contracts

Use when:

- support and certification depend on exact images
- private module distribution should stay image-oriented

## Entitlement and install posture

Future commercial deployments may combine:

- signed offline license file
- API-side entitlement verification
- private registry access
- certified build provenance
- support and update access

None of those require publishing private implementation code in the public
repository.

## Non-goals

- no remote module marketplace inside the public core
- no auto-download of arbitrary code from untrusted sources
- no private signing key in the public repository
- no payment processor integration in this preparation phase
