# Local Install License Protection

Last updated: 2026-06-07.

This document describes the intended protection model for local and self-hosted
Pro or Enterprise installs.

## Free installs

Free installs require no activation and no license file.

The public Core or Free edition should remain installable from the public
repository without contacting an external license service.

## Pro and Enterprise installs

Future Pro and Enterprise local installs are intended to use signed offline
license files verified by the API.

The API remains the entitlement authority. FreeSWITCH does not enforce
commercial licensing.

## Verification posture

The intended API-side flow is:

1. read configured license file path
2. load configured public verification key
3. verify the signed offline license document
4. derive the deployment edition and entitlements
5. enable only entitled commercial module paths
6. fall back safely when the file is missing, expired, invalid, or not entitled

## Safe degradation rules

- Missing license should default to Free behavior.
- Invalid license should fall back to a safe degraded mode.
- Existing live call routing must not be interrupted abruptly by license checks.
- Entitlement failures should block premium control-plane features rather than
  breaking the FreeSWITCH runtime itself.

## Protection posture

Local install protection is tamper-resistant, not tamper-proof.

That is acceptable because serious commercial protection comes from:

- private modules
- private registries
- private images
- official support access
- certified builds
- contract terms
- trademark control

## Key rules

- Public verification keys may be embedded or configured.
- The private signing key must never be committed.
- License generation and signing tooling must stay private.
- Frontend hiding alone is not sufficient.
- FreeSWITCH must not become the license enforcement boundary.
