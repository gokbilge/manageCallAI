# Module Boundary

Last updated: 2026-06-07.

This document defines the public module boundary that lets future private Pro
and Enterprise functionality attach to the public core without exposing private
implementation code in the repository.

## Goal

The public repository should provide stable extension points for:

- capability registration
- API route registration
- worker registration
- UI extension registration
- audit event registration

Private commercial modules may implement those interfaces later, but the public
repository should only contain the interface contracts and safe registration
rules.

## Public module interface

The public module boundary is exposed through `@managecallai/contracts`.

Key interfaces:

- `ManageCallAIEdition`
- `ManageCallAIModule`
- `CapabilityRegistry`
- `ModuleApiContext`
- `WorkerRegistry`
- `UiExtensionRegistry`
- `AuditEventRegistry`
- `StaticModuleRegistry`

These public contracts intentionally use abstract references such as `unknown`
for application-framework objects. The goal is compatibility and safe
registration, not a promise that public Core will dynamically load arbitrary
module code today.

## Safety rules

- Do not load unknown remote code.
- Do not auto-enable modules without API-side entitlement.
- Do not commit private modules to the public repository.
- Do not use frontend-only hiding as the effective enforcement layer.
- Do not let modules bypass the API's audit, capability, approval, or safety
  boundaries.

## Loading posture

The intended loading model is explicit local installation, not remote fetch:

- operator installs public Core
- operator adds approved private module package, mounted directory, or private
  bundled image
- API starts with a known module list
- API verifies the local entitlement state
- API enables only the entitled module registrations

The public repository does not implement arbitrary plugin download or remote
execution.

## Commercial posture

Private modules may later register:

- additional capability keys
- premium API routes
- metering hooks
- premium dashboard panels
- advanced audit event types
- premium workers

The private implementation stays outside the public tree. The public tree keeps
only the registration boundary.
