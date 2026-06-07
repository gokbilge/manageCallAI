# Entitlement Protection Roadmap

Last updated: 2026-06-07.

This roadmap defines the staged preparation of manageCallAI for an open-core
Free, Pro, and Enterprise architecture.

## v0.7.5

Primary goals:

- Free, Pro, and Enterprise documentation baseline
- distribution profiles
- public versus private feature boundary
- module interface contracts
- signed license-file design
- `EntitlementService` integration plan at the API boundary

Expected public outputs:

- open-core architecture docs
- deployment docs and compose profiles
- public contracts for future module registration
- invalid example license files for documentation

## v0.7.6

Primary goals:

- usage metering foundation
- add-on pack planning
- monthly usage report design
- license status UI design
- module-loader skeleton if maintainers approve public scaffolding

Expected direction:

- API still remains entitlement authority
- Free remains usable without activation
- Pro and Enterprise self-hosted path is documented around signed offline
  entitlements

## v0.8.x

Primary goals:

- first private Pro and Enterprise module integration
- private registry workflow
- advanced migration assistant private module
- enterprise audit and export private module
- SSO connector private module
- certified image workflow

Expected commercial posture:

- public core remains installable
- private modules remain outside the public repository
- official certified images and support-backed builds become part of commercial
  distribution rather than public fork inheritance
