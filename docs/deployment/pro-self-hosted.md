# Pro Self-Hosted

Last updated: 2026-06-07.

This document describes the intended Pro self-hosted deployment profile.

## Core rules

- Pro and Enterprise self-hosted installs are intended to use signed offline
  license files.
- The API verifies the signed file and derives deployment entitlements.
- Missing license defaults to Free behavior.
- Invalid license falls back to safe degraded mode.
- Live call routing must not be interrupted by license checks.
- FreeSWITCH does not enforce commercial licensing.

## Current packaging posture

For the v0.7.5 and v0.7.6 preparation phase, Pro uses the same public core
images as Free.

Use:

- [`docker-compose.pro.yml`](../../docker-compose.pro.yml)
- [`.env.pro.example`](../../.env.pro.example)

The profile mounts a read-only local license directory for the API:

- `./license:/etc/managecallai/license:ro`

## Future commercial posture

Later Pro packaging may add:

- private Pro module packages
- private bundled Pro images
- support-linked certified builds
- private registry access

This repository prepares the boundary and the profile only. It does not contain
private Pro implementation modules.
