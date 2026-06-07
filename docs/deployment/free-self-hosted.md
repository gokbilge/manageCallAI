# Free Self-Hosted

Last updated: 2026-06-07.

This document describes the intended Free self-hosted deployment profile for
manageCallAI Core.

## Core rules

- Free works without activation.
- No local license file is required.
- Missing license state defaults to Free behavior.
- The API remains the entitlement authority.
- FreeSWITCH does not enforce commercial licensing.

## Current packaging posture

For the v0.7.5 and v0.7.6 preparation phase, Free uses the same public core
images as the rest of the public deployment stack.

Use:

- [`docker-compose.free.yml`](../../docker-compose.free.yml)
- [`.env.free.example`](../../.env.free.example)

## What Free includes

Free is the public self-hosted and community edition built from the public Core.

That means:

- public API and worker images
- public FreeSWITCH image
- public Go agent image
- public docs
- no private module dependency

## Operational note

If a future entitlement file is absent or invalid, Free behavior is the safe
fallback. Live call routing should not be interrupted solely because a
commercial entitlement is unavailable.
