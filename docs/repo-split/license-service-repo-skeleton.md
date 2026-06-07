# License Service Repo Skeleton

Last updated: 2026-06-07.

This document defines the intended directory structure for the future private
`gokbilge/manageCallAI-license-service` repository. Nothing is implemented yet.

**This is the most sensitive repository in the model.**

**CRITICAL RULES:**
- Private signing keys must NEVER be committed to this or any git repository.
- All key material must live in an HSM, cloud key management service, or
  offline secure storage.
- Real customer license files must not be committed.
- Customer data must not be committed.
- The license generator reads key material at runtime from a secret manager.

---

## Intended structure

```
manageCallAI-license-service/
│
├── README.md                          # Private — do not publish
├── LICENSE                            # Internal — do not publish
├── package.json
│
├── apps/
│   │
│   ├── license-api/                   # License issuance and activation API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── issue.ts           # POST /license/issue
│   │   │   │   ├── activate.ts        # POST /license/activate
│   │   │   │   ├── revoke.ts          # POST /license/revoke
│   │   │   │   └── verify.ts          # GET  /license/verify
│   │   │   ├── signing/               # Signs with key from secret manager
│   │   │   │   └── signer.ts          # Key loaded at runtime — NOT committed
│   │   │   └── db/                    # Issuance audit log
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── customer-portal/               # Customer license management portal
│       ├── src/
│       └── package.json
│
├── tools/
│   │
│   ├── license-generator/             # Offline license generation tooling
│   │   ├── src/
│   │   │   └── generate.ts            # Reads key from HSM/secret manager
│   │   └── README.md
│   │
│   ├── license-verify/                # License file verification test tools
│   │   ├── src/
│   │   └── tests/
│   │
│   └── key-rotation/                  # License signing key rotation tooling
│       ├── src/
│       └── docs/
│           └── rotation-procedure.md  # Procedure doc — no live keys
│
├── docs/
│   ├── key-management/                # Key management procedures (no keys)
│   │   ├── hsm-setup.md
│   │   ├── key-rotation.md
│   │   └── disaster-recovery.md
│   ├── activation-protocol/           # Activation protocol specification
│   │   ├── protocol.md
│   │   └── offline-flow.md
│   ├── license-format.md              # License file format specification
│   └── customer-portal-guide.md
│
└── scripts/
    ├── audit-issuances.mjs            # Query issuance audit log
    └── validate-license.mjs           # Test: verify a sample license (test keys only)
```

---

## Key management architecture

```
Production signing key
  → Stored in HSM or cloud KMS (AWS KMS, Azure Key Vault, GCP Cloud KMS)
  → Never extracted to plaintext
  → License API reads key reference from environment variable at runtime

Offline license generator
  → Operator loads key from HSM offline
  → Generates signed license file
  → Key never touches disk in plaintext

Test signing key (separate from production)
  → Used only in test environments
  → May be in test fixtures — clearly labeled "TEST KEY ONLY"
  → Must not be used for real customer licenses
```

---

## License file format

License files are signed JSON payloads. The public verifier is part of the
public `packages/contracts` or a separate public verification package. The
private signer lives only in this repo.

The public entitlement service verifies signatures but never generates them.

---

## Related documents

- [`private-repo-map.md`](./private-repo-map.md)
- [`../commercial/offline-license-file-format.md`](../commercial/offline-license-file-format.md)
- [`../commercial/license-threat-model.md`](../commercial/license-threat-model.md)
- [`../commercial/local-install-license-protection.md`](../commercial/local-install-license-protection.md)
