# manageCallAI UI Architecture

## 1. Purpose

This document defines the frontend UI architecture for `manageCallAI`.

The platform has two operator surfaces:

1. **Platform Management UI**
2. **Tenant Admin UI**

Both surfaces should be implemented inside one React application during MVP, using role-based workspaces and shared components.

## 2. UI Product Model

manageCallAI is not a simple PBX panel.

It is an AI-native telecom control plane where humans, workflows, and AI agents manage telecom behavior through safe abstractions.

The UI must therefore make the following concepts visible:

- Desired state
- Draft state
- Validation state
- Simulation state
- Published state
- Rollback history
- Runtime call events
- AI/MCP activity
- n8n workflow integration
- Auditability

## 3. UI Surfaces

### 3.1 Platform Management UI

Used by platform operators, super admins, and managed-service maintainers.

Primary responsibilities:

- Manage tenants
- View tenant health
- View FreeSWITCH runtime nodes
- View Go runtime agents
- Inspect global runtime events
- Manage global policies
- Manage runtime tokens
- Review system audit logs
- Configure global MCP/tool policy
- Monitor webhook delivery
- Manage platform-level feature flags

Example routes:

```text
/platform
/platform/tenants
/platform/tenants/:tenantId
/platform/runtime
/platform/runtime/freeswitch
/platform/runtime/agents
/platform/events
/platform/audit
/platform/settings
/platform/settings/mcp
/platform/settings/webhooks
```

### 3.2 Tenant Admin UI

Used by customer/company administrators.

Primary responsibilities:

- Manage extensions
- Manage SIP credentials/devices
- Manage DIDs/numbers
- Manage inbound routes
- Manage outbound routes
- Upload and manage prompts
- Build IVR flows visually
- Validate and simulate changes
- Publish and rollback versions
- View call events and CDRs
- Manage tenant users and roles
- Configure n8n webhooks
- Configure MCP/AI permissions

Example routes:

```text
/tenant
/tenant/dashboard
/tenant/extensions
/tenant/extensions/:extensionId
/tenant/numbers
/tenant/routes/inbound
/tenant/routes/outbound
/tenant/prompts
/tenant/flows
/tenant/flows/:flowId
/tenant/flows/:flowId/simulate
/tenant/calls
/tenant/calls/:callId
/tenant/audit
/tenant/integrations/n8n
/tenant/integrations/mcp
/tenant/settings/users
/tenant/settings/policies
```

## 4. One App, Two Workspaces

For MVP, use one React app:

```text
apps/web
```

Do not create separate frontend apps yet.

Recommended structure:

```text
apps/web/src/
  app/
    router.tsx
    providers.tsx
    layout.tsx

  features/
    auth/
    platform/
    tenant/
    extensions/
    numbers/
    routes/
    prompts/
    flows/
    calls/
    audit/
    integrations/
    settings/

  components/
    ui/
    layout/
    data/
    forms/
    feedback/
    flow-builder/

  lib/
    api/
    auth/
    permissions/
    routes/
    formatting/

  styles/
    app.css
    tokens.css
```

## 5. Workspace Selection

After login:

```text
if user has platform permissions:
  show Platform Workspace

if user has tenant permissions only:
  redirect to Tenant Workspace

if user has access to multiple tenants:
  show tenant switcher
```

Workspace state should be explicit in the URL, not hidden only in global state.

Good:

```text
/platform/tenants
/tenant/extensions
```

Avoid:

```text
/dashboard
```

unless the active workspace is obvious.

## 6. Permission-Driven Navigation

Navigation should be generated from capabilities.

Example capabilities:

```text
platform.tenants.view
platform.tenants.create
platform.runtime.view
platform.audit.view

tenant.extensions.view
tenant.extensions.create
tenant.flows.view
tenant.flows.edit
tenant.flows.validate
tenant.flows.simulate
tenant.flows.publish
tenant.flows.rollback
tenant.calls.view
tenant.integrations.mcp.manage
tenant.integrations.n8n.manage
```

The UI should hide unavailable actions but backend authorization remains authoritative.

## 7. Layout Architecture

Use a stable enterprise layout:

```text
Top bar
  - workspace switcher
  - tenant switcher
  - environment badge
  - user menu

Left sidebar
  - primary navigation

Main content
  - page header
  - action bar
  - content area

Right panel
  - contextual inspector
  - activity timeline
  - validation details
```

For the visual flow builder:

```text
Left panel: node palette
Center: canvas
Right panel: selected node inspector
Bottom/status area: validation/simulation/publish state
```

## 8. Data Loading

Recommended frontend stack:

- React
- TypeScript
- Vite
- TanStack Router or React Router
- TanStack Query
- React Hook Form
- Zod
- React Flow
- Tailwind CSS
- shadcn/ui-style component primitives
- Lucide React icons

Rules:

- Server state belongs in TanStack Query.
- Form state belongs in React Hook Form.
- URL state should hold filters, tabs, selected flow version, and simulation scenario where practical.
- Local component state should be used only for transient UI behavior.

## 9. API Client

Create a typed API client:

```text
src/lib/api/client.ts
```

Later generate it from OpenAPI.

All API calls should go through one client layer to enforce:

- Auth token injection
- Error normalization
- Tenant/workspace context
- Request ID propagation
- Consistent response parsing

## 10. Critical UX Surfaces

### 10.1 Flow Publish UX

Publishing must never feel like a casual save.

Required UI pattern:

```text
Draft changed
↓
Validate
↓
Simulate
↓
Review impact
↓
Approve / Publish
↓
Published version visible
↓
Rollback available
```

### 10.2 Runtime Event UX

Call events should be shown as a timeline:

- Call created
- Answered
- DTMF collected
- Transferred
- Hangup
- CDR finalized

Use business-level labels first. Raw FreeSWITCH event payloads should be expandable for debugging, not primary UI.

### 10.3 AI/MCP UX

AI actions should be visible as change proposals.

Show:

- Actor: AI agent / workflow / user
- Tool used
- Proposed object
- Risk level
- Validation result
- Simulation result
- Approval status
- Audit trail

## 11. MVP UI Scope

Build first:

- Auth
- Tenant dashboard
- Extensions list/create/edit
- FreeSWITCH directory smoke-test helper
- Call events list
- Platform tenant list
- Basic runtime health page

Then:

- Prompt manager
- Inbound route management
- IVR flow list/detail foundation
- Visual IVR builder
- Validation/simulation UI
- Publish/rollback UI
- MCP/n8n integration screens

## 12. Non-Goals for MVP UI

Do not build initially:

- Full call center wallboard
- Billing UI
- Softphone
- WebRTC phone
- Full device provisioning UI
- Advanced report builder
- White-label theming

---

## 13. Implementation Status (as of v0.2.0-beta.1)

Last updated: 2026-06-02.

This section records what is actually built in `apps/web/` against the
architecture above. It is the ground-truth complement to the design intent above.

### Technology stack (implemented)

| Capability | Planned | Implemented |
|---|---|---|
| Framework | React + TypeScript | React 18 + TypeScript 5 |
| Build | Vite | Vite (with `@vitejs/plugin-react`) |
| Routing | TanStack Router or React Router | React Router DOM v7 |
| Server state | TanStack Query | TanStack Query v5 |
| Forms | React Hook Form | React Hook Form v7 |
| Schema validation | Zod | Zod v3 (via `@managecallai/contracts`) |
| Flow builder | React Flow | ReactFlow v11 |
| CSS | Tailwind CSS | Tailwind v4 (`@theme` tokens, no config file) |
| Icons | Lucide React | Lucide React (exclusive, no emoji) |
| Fonts | Inter + JetBrains Mono | Google Fonts CDN — Inter 400/500/600/700, JetBrains Mono 400/500/600 |
| Component primitives | shadcn/ui-style | Custom design-system components in `components/ui/` and `components/data/` |

### Design tokens (implemented)

Tokens live in `apps/web/src/styles/tokens.css` as Tailwind `@theme` variables.
They mirror the plain-CSS spec in `docs/design/ux-design.md`.

Key token groups:

- **Colors:** `--color-bg`, `--color-fg`, `--color-surface`, `--color-surface-muted`, `--color-border`, `--color-primary` (`#0f62fe`), `--color-platform` (`#4f46e5`), `--color-tenant` (`#0891b2`), semantic status colors
- **Fonts:** `--font-sans` (Inter), `--font-mono` (JetBrains Mono)
- **Radius:** `--radius-sm/md/lg/xl/2xl` (6 / 8 / 12 / 16 / 20 px)
- **Shadow:** `--shadow-card` (barely-there 2-layer slate), `--shadow-popover`

### Layout (implemented)

The 3-column app shell is live:

```text
<TopBar />                                 64px sticky, blur-bg, brand mark + workspace badge
<AlphaBanner />                            warning stripe, dismissible
<div grid: 17rem | 1fr | 20rem>
  <AppSidebar workspace={workspace} />     permission-filtered nav, workspace-coloured active state
  <main><Outlet /></main>                  route content
  <InspectorPanel workspace={workspace} /> context inspector, operator notes
</div>
```

Route workspace detection from URL prefix (`/platform/*` → platform, `/tenant/*` → tenant).

### Components (implemented)

**Primitives (`components/ui/`):**
- `Button` — 5 variants: primary, secondary, outline, ghost, destructive
- `StatusBadge` — pill with Lucide icon; states: active, inactive, draft, published, validated, warning
- `WorkspaceBadge` — workspace-coloured pill; platform (indigo) / tenant (cyan)
- `AlphaBanner` — dismissible warning stripe (localStorage-persisted)

**Data (`components/data/`):**
- `DataCard` — white card, `--radius-2xl` corners, `--shadow-card`, title + optional description
- `StatCard` — `DataCard` + large value + tinted icon tile (platform/tenant/info/success tone)

**Layout (`components/layout/`):**
- `TopBar` — brand mark, workspace switcher button, Bell, SignOut
- `AppSidebar` — permission-filtered `NavLink` list, workspace-coloured active state, runtime posture tile
- `PageHeader` — eyebrow (uppercase, muted, `0.16em` tracking) + H1 + description + optional actions
- `InspectorPanel` — operator context notes card with ShieldAlert / Bot / Clock3 icons

### Feature pages (implemented)

| Route | Component | Status |
|---|---|---|
| `/auth` | `AuthPage` | Implemented — login/register tabs, `react-hook-form`, API-connected |
| `/tenant/extensions` | `ExtensionsPage` | Implemented — live API, create form, SIP credential note |
| `/tenant/cockpit` | `ObservabilityCockpitPage` | Implemented — SSE snapshot, stat tiles, sessions table, node health panel, webhook backlog |
| `/tenant/ivr-flows/:id` | `IvrFlowDetailPage` + `IvrFlowBuilderNode` | Implemented — visual builder with toned nodes by type |
| `/tenant/approvals` | `ApprovalsPage` | Implemented — approve/reject, policy list |
| `/tenant/compliance` | `CompliancePage` | Implemented — retention policy + legal hold management |
| `/tenant/security-alerts` | `SecurityAlertsPage` | Implemented |
| `/platform` | `PlatformHomePage` | Implemented |
| `/platform/tenants` | `PlatformTenantsPage` | Implemented |
| `/platform/runtime` | `RuntimeHealthPage` | Implemented |

All lazy-loaded pages use `React.lazy` + `Suspense`.

### Brand assets (implemented)

`apps/web/public/`:
- `manageCallAILightBackground.svg` — black mark, transparent bg (light surfaces)
- `manageCallAIDarkBackground.svg` — cyan `#00d1d1` mark, transparent bg (dark surfaces)
- `manageCallAI.png` / `.jpg` — square avatar; `.png` used as favicon

In-app logo lockup: `Shield` Lucide icon in a 40×40px dark rounded tile (top bar) paired with the "manageCallAI" wordmark.

### Remaining UI work before beta-ready

- n8n example workflows — 10 templates documented in `docs/ops/n8n-setup.md`; end-to-end import/run proof not yet evidenced
- MCP capability matrix — setup guide at `docs/ops/mcp-setup.md`; end-to-end tool-call proof not yet evidenced
- SDK publish — dry-run or publish evidence for the beta candidate (latest workflow run failed)
- Broader operator workflow evidence — screenshots/tests for IVR approval flow, rollback, and observability HUD from a running stack
- Accessibility audit — no formal a11y review yet; focus rings implemented, aria-hidden used, but no full audit
