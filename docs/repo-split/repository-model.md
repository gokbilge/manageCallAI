# Repository Model

Last updated: 2026-06-07.

This document defines the five-repository architecture for manageCallAI as the
project transitions from a public monorepo to a structured open-core model.

## Why five repos

The original single public monorepo contained everything: public core, internal
planning, commercial docs, and placeholders for private modules. As the project
matures toward paid Pro and Enterprise editions, the code and documentation must
be split by ownership, confidentiality, and distribution channel.

The five-repo model achieves:

- public core remains fully open and installable
- paid implementation never enters public history
- internal planning and commercial docs stay private
- signing keys and license generation are isolated from all source repos
- each repo has a single, auditable purpose

## Existing public history is permanent

All code committed to the public `gokbilge/manageCallAI` repository under
Apache-2.0 is permanently public. This includes:

- all commits through the current HEAD on `main`
- all releases from v0.2.0-alpha through v0.6.2 and beyond
- migration 0077 (entitlement foundation)
- all public commercial docs and interfaces

Nothing in this architecture reverses that. The five-repo split affects only
**future** work, not existing public history.

---

## A — Internal private monorepo

**Future repo:** `gokbilge/manageCallAI-internal`
**Visibility:** private

This is the internal full source-of-truth. It is a superset of the public repo
and is the authoritative working copy for maintainers. All development work
happens here before being published to the public repo via the allowlist-based
export process.

**Contains:**
- everything in the public core repo
- commercial module integration stubs and contracts
- private module integration tests
- internal release tooling and publish scripts
- internal planning documents and roadmaps
- commercial docs not intended for public release
- enterprise planning and private architecture notes
- license-service integration docs and API contracts (no keys)

**Does NOT contain:**
- private signing keys or HSM credentials
- production environment secrets
- real customer licenses or activation records
- customer contracts or commercial agreements
- real customer data of any kind

---

## B — Public Free/Core repo

**Future repo:** `gokbilge/manageCallAI`
**Visibility:** public (already exists)

This is the permanent public Apache-2.0 open-source repository. It is produced
by an allowlist-based export from the internal monorepo and represents only what
the project intends to release publicly.

**Contains:**
- core PBX/control-plane code (API, web, MCP, worker, FreeSWITCH agent)
- public REST API and SDK
- public contracts and types
- public entitlement framework (migration 0077 and EntitlementService)
- public Free/Pro/Enterprise docs at the level defined in public-core-allowlist.md
- public distribution profiles and Dockerfiles
- public examples with invalid-only license files
- public schema boundary guard scripts

**Must NOT contain:**
See `public-core-denylist.md` for the exhaustive list.

---

## C — Private Commercial repo

**Future repo:** `gokbilge/manageCallAI-commercial`
**Visibility:** private

Contains Pro/commercial module implementations. This repo does not exist yet;
its skeleton is defined in `commercial-repo-skeleton.md`.

**Future contents:**
- Pro add-on module implementations
- advanced AI workflow implementations
- AI gateway integration
- commercial usage reporting
- add-on pack server-side enforcement
- paid migration preview implementation
- commercial billing export
- Pro private Docker build overlays
- commercial schema migrations (in `managecallai_commercial` schema)

---

## D — Private Enterprise repo

**Future repo:** `gokbilge/manageCallAI-enterprise`
**Visibility:** private

Contains enterprise/operator/reseller module implementations. This repo does
not exist yet; its skeleton is defined in `enterprise-repo-skeleton.md`.

**Future contents:**
- SSO/SAML/OIDC connectors
- enterprise audit and compliance export
- legal hold
- HA deployment automation
- reseller/operator reporting
- advanced migration assistant
- CUCM/Avaya/Alcatel importers
- cutover/rollback evidence automation
- carrier interop certification private packs
- enterprise private Docker build overlays
- enterprise schema migrations (in `managecallai_enterprise` schema)

---

## E — Private License Service repo

**Future repo:** `gokbilge/manageCallAI-license-service`
**Visibility:** private

Isolated license generation, activation, and customer portal. This is the most
sensitive repo in the model and must never contain committed private signing keys.

**Future contents:**
- license generator (reads key from HSM/secret manager at runtime)
- activation service
- signing workflow automation
- license verification test tools
- customer portal
- license issuance audit logging

**Must NEVER contain:**
- committed private signing keys (use HSM or secret manager)
- real customer license files committed to git
- private key material of any kind committed in plaintext

---

## Publication flow

```
Internal monorepo (gokbilge/manageCallAI-internal)
       │
       │  export-public-core.mjs
       │  (allowlist filter + denylist scan + secret scan)
       ▼
Public repo (gokbilge/manageCallAI)
       │
       │  tagged release
       ▼
Public Docker images / package registry

Private commercial module ──────────────────────────────┐
Private enterprise module  ──────────────────────────────┤
(separate private repos)                                 │
                                                         ▼
                                            Pro/Enterprise deployment
                                            (private images + signed license)
```

---

## Related documents

- [`public-core-allowlist.md`](./public-core-allowlist.md)
- [`public-core-denylist.md`](./public-core-denylist.md)
- [`private-repo-map.md`](./private-repo-map.md)
- [`publish-core-process.md`](./publish-core-process.md)
- [`release-staging-plan.md`](./release-staging-plan.md)
- [`../commercial/public-vs-private-schema-boundary.md`](../commercial/public-vs-private-schema-boundary.md)
