# License Threat Model

Last updated: 2026-06-07.

This threat model covers the future local-license and entitlement posture for
manageCallAI open-core deployments.

## Assets

- private signing key
- signed offline license files
- public verification key
- entitlement state derived by the API
- private module packages and private images
- support, certification, and update access

## Core truths

- Local protection is tamper-resistant, not tamper-proof.
- Private modules and private distribution are stronger protection than local
  client-side secrecy.
- FreeSWITCH is not the commercial enforcement point.
- The API is the entitlement authority.

## Main threats

| Threat | Risk | Mitigation posture |
| --- | --- | --- |
| License file copying between deployments | A valid file is reused beyond the contracted scope. | Include deployment-mode and instance or node limits; verify in API; pair with support and audit processes. |
| Local binary or code patching | Operator modifies local code to skip checks. | Keep high-value features in private modules and private images; rely on contract, support, and distribution control as the stronger layer. |
| Fake or forged license files | Operator fabricates a file. | Verify signatures with public key; keep signing key private. |
| Public repo fork claims commercial parity | Fork uses public code and imitates official edition naming. | Enforce trademark and certification policy outside the code license. |
| Private key leakage | Signing authority is compromised. | Never commit signing key; keep signing tooling private; support key rotation. |
| Frontend-only gating bypass | Browser user enables hidden feature paths. | Enforce entitlement at the API boundary. |
| FreeSWITCH-side enforcement drift | Runtime components gain ad hoc license behavior. | Keep licensing out of FreeSWITCH, Lua, and raw ESL paths. |

## Protection strategy

The commercial protection stack should be layered:

1. API entitlement checks
2. signed offline license verification
3. private module distribution
4. private package or image registries
5. support and update access
6. trademark and certified-build control
7. legal agreement terms

## Non-goals

- perfect anti-tamper guarantees on self-hosted infrastructure
- hiding already-public source code
- embedding commercial enforcement inside FreeSWITCH
