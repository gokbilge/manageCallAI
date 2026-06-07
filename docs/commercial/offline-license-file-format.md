# Offline License File Format

Last updated: 2026-06-07.

This document describes the intended offline signed license-file shape for
future self-hosted Pro and Enterprise deployments.

## Purpose

The file format is a public documentation contract. It is not a commitment that
all fields are implemented yet, and it does not include real signing material.

## Required fields

A future license file should include at minimum:

- `license_id`
- `customer_name`
- `edition`
- `issued_at`
- `expires_at`
- `deployment_mode`
- `max_instances`
- `max_nodes`
- `entitlements`
- `signature`

## Example structure

```json
{
  "license_id": "lic_example_123",
  "customer_name": "Example Customer",
  "edition": "pro",
  "issued_at": "2026-01-01T00:00:00Z",
  "expires_at": "2027-01-01T00:00:00Z",
  "deployment_mode": "self_hosted",
  "max_instances": 2,
  "max_nodes": 2,
  "entitlements": [
    "pro.analytics",
    "pro.support"
  ],
  "signature": "base64url-signature-over-canonical-payload"
}
```

## Field guidance

### `license_id`

Stable identifier for support, renewal, and audit workflows.

### `customer_name`

Customer-facing name from the commercial agreement. Do not commit real customer
names to the repository.

### `edition`

Expected values:

- `free`
- `pro`
- `enterprise`

`free` should not normally require a signed file, but the enum is retained for
schema clarity.

### `deployment_mode`

Examples:

- `self_hosted`
- `private_cloud`
- `managed_service`

### `max_instances` and `max_nodes`

Deployment ceiling values used for entitlement checks and future reporting.

### `entitlements`

Array of deployment or capability grants derived from the signed license.

### `signature`

Detached or embedded cryptographic signature over the canonical payload.

The private signing key must never be committed.

## Design rules

- The API is the verification authority.
- Public key verification may be embedded or configured.
- License verification should be deterministic and auditable.
- Missing or invalid files must degrade safely to Free behavior rather than
  abruptly breaking live telephony runtime.
