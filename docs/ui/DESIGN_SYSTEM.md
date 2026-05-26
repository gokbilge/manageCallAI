# manageCallAI Design System

## 1. Purpose

This document defines the visual design system for manageCallAI.

The design system should support:

- enterprise clarity
- telecom operational density
- AI/workflow auditability
- accessibility
- platform and tenant workspaces
- visual IVR building

## 2. Recommended Stack

```text
React
TypeScript
Tailwind CSS
shadcn/ui-style primitives
Radix UI primitives where needed
React Flow
Lucide React
TanStack Query
React Hook Form
Zod
```

Tailwind should be used as the token-to-utility layer. Tailwind theme variables can represent design tokens such as colors, fonts, spacing, radius, shadows, and breakpoints.

## 3. Visual Direction

Keywords:

- calm
- precise
- technical
- trustworthy
- auditable
- modern enterprise

Avoid:

- playful consumer SaaS
- overly colorful dashboards
- heavy gradients
- unnecessary glassmorphism
- telecom equipment nostalgia

## 4. Color System

### 4.1 Semantic Colors

Use semantic tokens instead of raw color names in components.

- background
- foreground
- surface
- surface-muted
- surface-raised
- border
- border-strong
- primary
- primary-foreground
- secondary
- muted
- accent
- success
- warning
- danger
- info
- focus

### 4.2 Workspace Accent

Use different but subtle workspace accents:

- Platform workspace: indigo / blue
- Tenant workspace: cyan / teal
- Danger/destructive: red
- Warning: amber
- Success: green
- Info: blue

The accent should support orientation, not branding noise.

## 5. Tailwind Token Schema

Recommended `apps/web/src/styles/tokens.css`:

```css
@import "tailwindcss";

@theme {
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --color-bg: #f8fafc;
  --color-fg: #0f172a;

  --color-surface: #ffffff;
  --color-surface-muted: #f1f5f9;
  --color-surface-raised: #ffffff;

  --color-border: #e2e8f0;
  --color-border-strong: #cbd5e1;

  --color-primary: #0f62fe;
  --color-primary-fg: #ffffff;

  --color-platform: #4f46e5;
  --color-tenant: #0891b2;

  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;
  --color-info: #2563eb;

  --color-muted: #64748b;
  --color-muted-fg: #475569;

  --color-focus: #0f62fe;

  --spacing: 0.25rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.25rem;

  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.08);
  --shadow-popover: 0 10px 30px rgb(15 23 42 / 0.12);

  --breakpoint-3xl: 112rem;
}

[data-theme="dark"] {
  --color-bg: #020617;
  --color-fg: #e2e8f0;
  --color-surface: #0f172a;
  --color-surface-muted: #111827;
  --color-border: #1e293b;
}
```

## 6. Typography

Use:

- Inter for UI
- JetBrains Mono for technical IDs, logs, call IDs, raw payloads

Type scale:

- Page title: `text-2xl / font-semibold`
- Section title: `text-lg / font-semibold`
- Card title: `text-base / font-semibold`
- Body: `text-sm`
- Secondary/meta: `text-xs` or `text-sm muted`
- Code/logs: `text-xs font-mono`

Rules:

- Avoid giant headings in data-heavy screens.
- Use compact but readable typography.
- Use monospace only for technical identifiers and logs.

## 7. Spacing and Density

Support two density modes later:

- comfortable
- compact

MVP default: comfortable enterprise density.

Common spacing:

- Page padding: `p-6`
- Card padding: `p-4` or `p-5`
- Table cell padding: `px-3 py-2`
- Form field gap: `gap-4`
- Section gap: `gap-6`

## 8. Component Rules

### Buttons

Variants:

- primary
- secondary
- outline
- ghost
- destructive

### Badges

Use badges for:

- draft
- validated
- simulated
- published
- failed
- active
- inactive
- requires approval
- AI-generated
- workflow-triggered

### Cards

Use cards for:

- dashboard summary
- validation result
- simulation result
- call event summary
- publish impact

### Tables

Tables must support:

- search
- filter
- status badge
- row actions
- empty state
- loading state
- error state

### Drawers

Use drawers for:

- create/edit extension
- route details
- prompt metadata
- audit event details
- raw call payload

### Modals

Use modals only for focused confirmations:

- publish
- rollback
- delete
- disable
- revoke

## 9. Flow Builder Design

Use React Flow.

Canvas layout:

- Left: node palette
- Center: graph canvas
- Right: node inspector
- Bottom: validation/simulation status

Node types:

- Start
- Play Prompt
- Collect Digits
- Condition
- Business Hours
- Transfer
- Queue
- Voicemail
- Webhook
- AI Action
- End

Node visual rules:

- Start: neutral
- Prompt: info
- Collect Digits: primary
- Decision/Condition: warning
- Transfer: success
- Webhook: accent
- AI Action: platform accent
- Error/Fallback: danger
- End: muted

Every node should show:

- node name
- type icon
- key configuration
- validation state
- connection handles

## 10. Status Language

Use consistent status vocabulary:

- Draft
- Validated
- Simulation Passed
- Simulation Failed
- Approval Required
- Published
- Rollback Available
- Inactive
- Runtime Error

Avoid mixing synonyms like:

```text
enabled / active / live / published
```

unless each has a distinct meaning.

## 11. Motion

Motion should be minimal:

- drawer open/close
- validation result reveal
- flow node selection
- toast entry/exit

Do not animate critical status changes excessively.

Respect reduced motion settings.

## 12. Theming Roadmap

MVP:

- light theme only
- stable tokens
- workspace accent

Next:

- dark theme
- compact density
- tenant logo/accent
- high contrast mode
