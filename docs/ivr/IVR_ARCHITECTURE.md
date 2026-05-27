# manageCallAI IVR Architecture

## 1. Thesis

`manageCallAI` IVR is a desired-state flow platform, not a FreeSWITCH XML
editor.

Humans, n8n automations, and future MCP tools all operate on the same tenant
scoped flow model. FreeSWITCH executes only approved and published state through
runtime adapters.

## 2. Core Layers

1. Flow Definition
2. Flow Version
3. Flow Validator
4. Flow Simulator
5. Flow Publisher
6. Runtime Resolver
7. FreeSWITCH Adapter
8. Audit / Approval / Rollback
9. n8n automation interface
10. MCP AI-safe tool interface

## 3. High-Level Architecture

```text
Human UI / n8n / MCP
        ↓
manageCallAI API
        ↓
Flow Draft / Version / Validation / Simulation / Publish
        ↓
Published Active Flow Version
        ↓
Runtime Resolver
        ↓
FreeSWITCH Adapter
        ↓
Stock FreeSWITCH
```

## 4. Model

### 4.1 Desired state first

The source of truth is a tenant-scoped IVR flow graph and its versions. The
platform does not treat raw FreeSWITCH XML, raw ESL commands, or Lua source as
the primary business model.

### 4.2 One safe lifecycle

Humans, n8n, and MCP all use the same lifecycle:

```text
draft → validate → simulate → approval/policy → publish → audit → rollback
```

The runtime only sees published state.

### 4.3 Runtime boundary

FreeSWITCH should execute business-approved actions only:

- play prompt
- collect digits
- transfer
- hangup
- set a small number of call variables if needed later

Business logic, safety policy, validation, simulation, and publish control stay
in the backend.

## 5. Responsibility Split

### Human UI

- Create and edit IVR drafts
- Inspect versions
- Run validation and simulation
- Request publish and rollback
- Review audit trail

### n8n

- Create drafts and update them through REST
- Trigger validation and simulation
- Request publish through an approval-aware path
- React to publish / rollback / call events

n8n is orchestration, not the real-time IVR engine.

### MCP

- Expose safe AI tools over the same draft/validate/simulate/publish lifecycle
- Never expose raw switch internals
- Never bypass approval or policy gates

MCP is a constrained AI tool layer, not raw telecom access.

### FreeSWITCH

- Execute published call actions through supported interfaces
- Remain stock
- Never become the system of record for IVR logic

## 6. Runtime Flow

1. Inbound DID resolves to an inbound route.
2. The inbound route points to a published IVR flow or other supported target.
3. Runtime resolver pins the active flow version for the lifetime of the call.
4. Thin runtime helper executes one action at a time.
5. The backend resolves the next state after each result.
6. Events are ingested for audit and observability.

## 7. Safety Properties

- Published versions are immutable.
- Mid-call behavior is pinned to the version active when the call entered.
- Validation is mandatory before publish.
- Simulation is strongly expected before publish and required for AI/n8n safety.
- Rollback always targets a prior published version, not mutable draft state.
- Runtime endpoints stay protected by runtime token auth.

## 8. Non-Goals

- No FreeSWITCH fork
- No raw ESL command exposure in public API
- No direct n8n real-time IVR runtime
- No MCP raw XML editing
- No full call center implementation in this slice
- No direct raw dialplan editing as the business model
