# Enterprise Private Deployment

Last updated: 2026-06-07.

This document describes the intended Enterprise private deployment posture.

## Core rules

- Enterprise self-hosted installs are intended to use signed offline license
  files verified by the API.
- Missing license defaults to Free behavior.
- Invalid license falls back to safe degraded mode.
- Live call routing must not be interrupted by license checks.
- FreeSWITCH does not enforce commercial licensing.
- The API remains the entitlement authority.

## Current packaging posture

For the v0.7.5 and v0.7.6 preparation phase, Enterprise still uses the same
public core images as Free and Pro, with profile-specific entitlement settings.

Use:

- [`docker-compose.enterprise.yml`](../../docker-compose.enterprise.yml)
- [`.env.enterprise.example`](../../.env.enterprise.example)

The Enterprise profile mounts:

- `./license:/etc/managecallai/license:ro`

## Planned extension points

The Enterprise profile reserves room for future private additions such as:

- external object storage
- backup and restore automation
- HA deployment workflow
- SSO integration
- support contract identifiers
- private module images
- private registry credentials

Those capabilities are not implemented by this change set. The profile only
documents where they will attach later.
