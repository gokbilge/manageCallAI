# Open-Source and Commercial Boundary

Last updated: 2026-06-07.

This document defines what is part of the open-source community edition, what
may become a commercial module, and what is intentionally deferred. It supports
the Free / Pro / Enterprise packaging roadmap starting in v0.7.5.

**This is a planning document. No code has been gated behind a commercial
license yet. All current functionality remains open-source.**

---

## Free Edition

Intended for: self-hosted operators, developers, small teams, and community
contributors.

**Included in open-source core (Apache-2.0 or future community license):**

- Full IVR flow design, simulation, publish, and rollback lifecycle
- Inbound routing, schedules, and time-based routing
- SIP trunk and extension management
- Basic voicemail and call recording
- Call groups and queues (standard)
- Outbound calling (basic)
- Tenant and user management
- Platform operator bootstrap and administration
- REST API, MCP server, and n8n workflow integration surface
- FreeSWITCH Go agent and Lua executor
- Database migrations and full self-hosted installability
- Community support (GitHub issues, documentation)

**Limits (to be defined by maintainers before v0.7.5 ships):**

- Tenant count, extension count, and concurrent call thresholds are TBD.
- No SLA commitment.
- No paid support.

---

## Pro Edition

Intended for: growing businesses and teams that need advanced automation,
AI-assisted features, and operator tooling.

**Planned Pro features (may require commercial entitlement):**

- AI-assisted IVR generation and draft editing
- Natural-language route and fraud-policy recommendations
- AI voicemail/call summaries and operator review
- Semantic recording and transcript search
- Softphone provisioning and QR onboarding
- Push notifications and mobile call controls
- Click-to-call from end-user surfaces
- Disposition codes and post-call notes
- CRM screen-pop integrations
- Campaign management baseline

**Posture:**

- Pro features will be gated by tenant entitlement, not removed from source.
- Source code for Pro features may remain in the open-source repository with
  entitlement checks, OR may be distributed as separate proprietary modules.
- This decision is deferred to the licensing model decision.
  See [`license-options.md`](./license-options.md).

---

## Enterprise Edition

Intended for: large enterprises, managed service providers, and operators
requiring advanced compliance, topology, and SLA guarantees.

**Planned Enterprise features (will require commercial entitlement):**

- Enterprise publish lifecycle parity (draft/validate/simulate/publish/rollback
  for all routing objects)
- Audit and approval parity for enterprise policy changes
- Cross-object enterprise validation engine
- Enterprise route and failover simulation depth
- Operator evidence and status views for enterprise routing
- Supervisor dashboard, controls, and queue SLA tracking
- Numbering plan and calling policy lifecycle
- Site and location domain model
- Trunk-group and route-list model with failover
- Line appearance and shared call appearance model
- Schedule groups with holiday calendars and override workflows
- Agent workspace baseline
- QA scoring
- PBX migration assistant (when shipped — currently post-v0.8.x)

**Posture:**

- Enterprise features require a commercial agreement.
- Deployment posture: self-hosted with commercial license, or hosted managed
  service (future).
- SLA, dedicated support, private modules, and reseller rights are commercial
  agreement terms.

---

## What remains available for self-hosted community use

The following will always be available for self-hosted deployment without a
commercial license, regardless of the future license model:

- Full telephony control plane (IVR, routing, trunks, extensions, voicemail)
- All database migrations
- FreeSWITCH integration layer (Go agent, Lua executor)
- REST API
- MCP and n8n integration surface (narrower than REST per ADR-0012)
- OpenAPI specification
- SDK types
- Self-hosting documentation and setup tooling

---

## What requires commercial entitlement

The following capabilities are planned to require a commercial entitlement in
Pro or Enterprise editions. **No entitlement gate is active today.**

- AI-assisted features beyond basic route risk analysis
- Enterprise lifecycle management features
- PBX migration assistant (when shipped)
- Managed hosted deployment
- Paid support and SLA
- Private module distribution
- Reseller rights

---

## What is intentionally deferred

The following are not in scope for v0.7.5 or v0.7.6 and require separate design
work before any code or licensing decision:

- Payment processing and subscription billing
- Telecom usage billing and CDR rate tables
- Tax/VAT handling
- Reseller portal
- White-label packaging
- Data processing agreements (DPA) and GDPR processor terms
- SLA agreement templates

See [`docs/planning/enterprise-deferral-register.md`](../planning/enterprise-deferral-register.md)
for the full deferral register.

---

## Maintainer decision required

The exact boundary between open-source and commercial will be finalised when
maintainers select the licensing model. See [`license-options.md`](./license-options.md).
