# License Options for manageCallAI

Last updated: 2026-06-07.

This document compares the licensing models available to manageCallAI as it moves
toward a Free / Pro / Enterprise commercial packaging model. It is a planning
document to inform maintainer and legal review. **No final decision has been made.**

---

## Option 1 — Apache-2.0 (current)

Keep Apache-2.0 for all editions. Commercial features are funded through
support contracts, hosting, and managed services rather than code access control.

| Dimension | Assessment |
|-----------|-----------|
| Adoption impact | Maximum. Permissive license removes all friction for evaluation and deployment. |
| Enterprise acceptance | High. Apache-2.0 is the most enterprise-accepted open-source license. |
| SaaS competitor risk | High. Anyone can host and sell manageCallAI as a service without contributing back. |
| Open-source community impact | Positive. No copyleft concern, easy contribution. |
| Commercial control | Low. Competitors can use the code freely. |
| Recommended use case | When adoption and ecosystem growth are the primary goals and competitive hosting risk is acceptable. |

---

## Option 2 — AGPL-3.0-or-later community edition

Relicense future versions to AGPL-3.0-or-later. Hosted operators must release
their modifications or purchase a commercial license.

| Dimension | Assessment |
|-----------|-----------|
| Adoption impact | Moderate. Many developers accept AGPL; some enterprises block it by policy. |
| Enterprise acceptance | Mixed. Enterprise legal teams often require a commercial license waiver for AGPL. |
| SaaS competitor risk | Low for honest actors. AGPL requires hosted operators to open-source modifications. |
| Open-source community impact | Moderate positive. Strong copyleft; some contributors prefer it, some avoid it. |
| Commercial control | High for hosted use. Forces competitors to either open-source or pay. |
| Recommended use case | When protecting against cloud competitors hosting the software without contributing is the primary goal. |

**Note:** Switching from Apache-2.0 to AGPL requires contributor permission. See
[`contributor-license-policy.md`](./contributor-license-policy.md).

---

## Option 3 — Dual license: AGPL-3.0-or-later + commercial

Offer AGPL-3.0-or-later for open-source use and a commercial license for
operators who cannot comply with AGPL requirements.

| Dimension | Assessment |
|-----------|-----------|
| Adoption impact | Moderate. Community edition is fully open. Commercial option requires a conversation. |
| Enterprise acceptance | Good. Enterprises who need it buy the commercial license; others use AGPL. |
| SaaS competitor risk | Low. Hosted use without AGPL compliance requires a paid license. |
| Open-source community impact | Positive for copyleft-friendly community. Contributors must sign CLA to allow dual-licensing. |
| Commercial control | High. Maintainers control both open-source and commercial license terms. |
| Recommended use case | Best balance of open-source presence and commercial protection. Industry standard for developer tools (e.g. MongoDB, MySQL, GitLab). |

**Note:** Dual-licensing requires all contributors to agree to a CLA (Contributor
License Agreement) granting the project maintainers the right to license their
contributions under commercial terms.

---

## Option 4 — Apache-2.0 core + proprietary Pro/Enterprise modules

Keep the core on Apache-2.0. Pro and Enterprise features are separate proprietary
modules, distributed under a commercial license, not included in the open-source
repository.

| Dimension | Assessment |
|-----------|-----------|
| Adoption impact | High for core. Pro/Enterprise modules require commercial agreement. |
| Enterprise acceptance | High. Core is fully open; enterprise modules are clear add-ons. |
| SaaS competitor risk | Moderate. Core can be hosted freely; Pro/Enterprise modules are proprietary. |
| Open-source community impact | Positive for core. Community does not get Pro/Enterprise features. |
| Commercial control | High for module features. Core remains open-source forever. |
| Recommended use case | When the open-source core is complete and valuable on its own, and commercial value is in add-on modules (e.g. HashiCorp Vault model). |

---

## Option 5 — Custom source-available license

Write a custom license (e.g., BSL, SSPL, or Elastic License 2.0 style) that
restricts competitive hosting.

| Dimension | Assessment |
|-----------|-----------|
| Adoption impact | Low to moderate. Custom licenses create legal uncertainty and distrust. |
| Enterprise acceptance | Low. Legal teams must review each custom license individually. |
| SaaS competitor risk | Low for targeted restrictions if license is well-drafted. |
| Open-source community impact | Negative. Custom licenses are not OSI-approved open source. |
| Commercial control | High if legal team drafts it well. |
| Recommended use case | Last resort; generally not recommended for community-built products. |

---

## Recommendation for manageCallAI

Based on the project's current stage, architecture, and goals:

### If adoption is the priority

**Apache-2.0 core + proprietary Pro/Enterprise modules (Option 4)**

Keep the IVR/routing core, FreeSWITCH integration, API surface, and self-hosting
capability under Apache-2.0 forever. Deliver AI features, enterprise lifecycle
management, PBX migration assistant, and managed hosting as commercial modules.

This model is used by HashiCorp (Vault, Terraform), Elastic, and many successful
open-core companies.

### If protection against hosted competitors is the priority

**AGPL-3.0-or-later + commercial dual license (Option 3)**

Relicense future versions to AGPL. Offer a commercial license to enterprises and
hosting providers. This is used by GitLab, MongoDB, and Sentry.

---

## Maintainer decision required

**This document is informational only. No relicensing has occurred. The final
licensing model must be selected by maintainers in consultation with legal counsel
before v0.7.5 ships.**

Checklist before deciding:
- [ ] Legal counsel has reviewed contributor permissions and CLA requirements.
- [ ] All substantial contributors have been identified.
- [ ] Copyright ownership has been confirmed.
- [ ] Community and enterprise users have been informed.
- [ ] A transition plan for existing Apache-2.0 releases has been documented.
