# SIP And Trunk Secret Handling

## Rules

- SIP auth passwords are write-only API inputs.
- API responses must never include SIP plaintext passwords, ciphertext, or key ids.
- Repositories may persist encrypted ciphertext and key id only.
- Logs, audit metadata, webhook payloads, MCP outputs, support bundles, and
  generated docs must not include trunk secrets.
- Trunk rotation should create a new encrypted secret version and audit the actor,
  never reveal the old value.

## Operational Guidance

- Use strong random trunk credentials per provider account.
- Prefer TLS and SRTP where the provider supports it.
- Restrict SIP ingress to known provider IP ranges at the network edge.
- Keep provider portal credentials out of manageCallAI; store only runtime SIP
  auth material needed by FreeSWITCH.
- Rotate credentials after suspected extension compromise, operator departure,
  or provider-side incident.

## Tests To Maintain

- SIP trunk create/update responses omit secret material.
- Support bundle and observability responses omit secret material.
- Secret encryption/decryption tests validate key id behavior without printing
  plaintext in failure output.
