# Licensing

## Current License

manageCallAI is currently licensed under the **Apache License, Version 2.0**.

The full license text is in [`LICENSE`](./LICENSE).

All releases up to and including the current published version are and will remain
available under Apache-2.0. **Existing Apache-2.0 releases are not retroactively
changed by any future licensing decision.**

## Why this document exists

The project is preparing a Free / Pro / Enterprise commercial packaging model
starting in v0.7.5. Before any license change is made, maintainers must:

1. Document the options and their implications.
2. Confirm copyright ownership and contributor permissions.
3. Decide the model with legal counsel.
4. Communicate the change clearly to users and contributors.

This file provides that documentation and is not itself a legal decision.

## Future licensing options under consideration

Maintainers are evaluating the following models for future versions. No change
has been made. The final decision requires legal review.

### Option A — Apache-2.0 core + proprietary Pro/Enterprise modules

Community core stays Apache-2.0. Pro and Enterprise features are delivered as
separate proprietary modules distributed under a commercial license.

### Option B — AGPL-3.0-or-later community edition + commercial license

The open-source edition is relicensed to AGPL-3.0-or-later. A separate
commercial license is offered to operators who cannot comply with AGPL copyleft
requirements (e.g., SaaS providers who do not want to open-source their
modifications).

### Option C — Dual-license: AGPL-3.0-or-later and commercial

Same as Option B but framed explicitly as a dual-license product. Users choose
between AGPL compliance and a paid commercial license.

A full comparison is in
[`docs/commercial/license-options.md`](./docs/commercial/license-options.md).

## What does not change under any option

- Existing Apache-2.0 releases remain under Apache-2.0.
- The core routing, IVR, and telephony control plane remains open-source.
- Self-hosted community use is not removed.
- The codebase history is not modified to hide the Apache-2.0 lineage.

## Commercial features

Pro and Enterprise features will be clearly separated from community features.
See [`docs/commercial/open-source-and-commercial-boundary.md`](./docs/commercial/open-source-and-commercial-boundary.md)
for the planned boundary.

Commercial license terms, payment processing, telecom billing, tax/VAT,
reseller agreements, and SLA terms are separate future documents not included here.
See [`docs/commercial/commercial-license-placeholder.md`](./docs/commercial/commercial-license-placeholder.md).

## Contribution and relicensing

Contributions to the repository fall under the active license unless otherwise
stated. Before switching from Apache-2.0 to AGPL or a commercial dual-license
model, maintainers must confirm contributor rights.

See [`docs/commercial/contributor-license-policy.md`](./docs/commercial/contributor-license-policy.md)
for the contributor clarity process.

## Maintainer decision required

**No license change has been made. The final licensing model requires a
maintainer decision and legal review before any change is applied.**
