# manageCallAI — UX and Design System

Last updated: 2026-06-02 (v0.2.0-beta.1).

This document records the visual design decisions, tokens, component patterns, and
UX principles for the manageCallAI operator console. It is derived from the
`managecallai-design-system` handoff bundle and the production implementation in
`apps/web/`.

For UI architecture and feature scope, see `docs/ui/UI_ARCHITECTURE.md`.
For component code, see `apps/web/src/components/` and `apps/web/src/styles/`.

---

## Product character

manageCallAI is an **enterprise operations console** — closer to a network/security
dashboard than a consumer app or chatbot. The design communicates:

- Safety, observability, control, and release discipline
- `draft → validate → simulate → publish → rollback` as the spine of every change
- Every consequential action is visible, reversible, and accountable

**In one line:** *a flight-deck for telecom.*

---

## Brand voice

- **Name:** always `manageCallAI` — lowercase `m`, camel-cased. Never "Manage Call AI" or "ManageCallAI".
- **Tone:** technical, calm, operationally serious. System voice ("Approved actions execute immediately"), not chatbot voice ("we'll help you"). Use "you" occasionally for helper copy; never "we".
- **Casing:** page titles are Title Case ("Live Cockpit", "Approval Queue"); eyebrows are UPPERCASE with wide tracking ("TENANT WORKSPACE"); body copy is sentence case.
- **Emoji:** none in the product UI. Status glyphs (✅/⛔) are table-only in repo docs.
- **Domain vocabulary (use precisely):** tenant, workspace, extension, SIP trunk, inbound/outbound route, IVR flow, session, node, runtime, prompt, approval, publish, rollback, simulate, validate, fraud policy, security alert, audit, webhook backlog, evidence gate.
- **Lifecycle status words:** draft, validated, simulated, published, rolled back — surface these as badges, not prose.
- **Identifiers:** always monospace, often truncated (`a1b2c3d4…`). Relative times humanized ("just now", "5s ago", "2m ago").

---

## Color system

### Base palette

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#f8fafc` | App canvas (slate-50) |
| `--color-fg` | `#0f172a` | Primary text (slate-900) |
| `--color-surface` | `#ffffff` | Cards, panels |
| `--color-surface-muted` | `#f1f5f9` | Table heads, inset rows (slate-100) |
| `--color-border` | `#e2e8f0` | Hairline borders (slate-200) |
| `--color-border-strong` | `#cbd5e1` | Emphasized dividers (slate-300) |
| `--color-muted` | `#64748b` | Muted icon color (slate-500) |
| `--color-muted-fg` | `#475569` | Secondary copy (slate-600) |

### Action and workspace

| Token | Hex | Role |
|---|---|---|
| `--color-primary` | `#0f62fe` | IBM Carbon blue — primary buttons, focus ring |
| `--color-primary-fg` | `#ffffff` | Text on primary |
| `--color-platform` | `#4f46e5` | Platform workspace identity (indigo) |
| `--color-tenant` | `#0891b2` | Tenant workspace identity (cyan) |
| `--color-brand-cyan` | `#00d1d1` | Brand mark color (dark surfaces only) |
| `--color-focus` | `#0f62fe` | Focus ring |

### Status semantics

| Token | Hex | Used for |
|---|---|---|
| `--color-success` | `#16a34a` | Active, validated, healthy |
| `--color-warning` | `#d97706` | Draft, stale, attention |
| `--color-danger` | `#dc2626` | Failure, hangup, destructive |
| `--color-info` | `#2563eb` | Published, neutral runtime info |

### Tint convention

Colored elements use **~8–10% alpha for the background** and the **solid color
for the icon/text** (e.g. `bg-success/10 text-success`). Never use solid saturated
fills for status — only for primary/destructive buttons.

```
bg-[var(--color-success)]/10  text-[var(--color-success)]   ← active, validated
bg-[var(--color-warning)]/10  text-[var(--color-warning)]   ← draft, stale
bg-[var(--color-danger)]/10   text-[var(--color-danger)]    ← error, hangup
bg-[var(--color-info)]/10     text-[var(--color-info)]      ← published
bg-[var(--color-platform)]/10 text-[var(--color-platform)]  ← platform workspace
bg-[var(--color-tenant)]/10   text-[var(--color-tenant)]    ← tenant workspace
```

---

## Typography

| Level | Size | Weight | Notes |
|---|---|---|---|
| Eyebrow | 12px | 600 | UPPERCASE, `0.16em` tracking, muted |
| H1 (page title) | 24px | 600 | `tracking-tight` (`-0.01em`) |
| H2 (card title) | 16px | 600 | — |
| Body | 14px | 400 | `line-height: 1.5` |
| Small / secondary | 13px | 400 | Muted |
| Label / table head | 12px | 500 | Muted |
| Monospace | 12px | 400 | JetBrains Mono — IDs, SIP usernames, call IDs, node tags |

**Fonts:** Inter (sans) + JetBrains Mono (mono). Loaded from Google Fonts in `index.html`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

---

## Spacing and layout

- **Base grid:** 4px (`--spacing: 0.25rem`)
- **Card padding:** 20px (`p-5`)
- **Section gaps:** 24px (`gap-6`)
- **App shell:** sticky top bar (64px) → alpha banner → 3-column grid:
  `[17rem sidebar | 1fr main | 20rem inspector]`, max-width `112rem`, 24px gutters

---

## Surfaces and elevation

| Surface | Radius token | Shadow | Border |
|---|---|---|---|
| Cards | `--radius-2xl` (20px) | `--shadow-card` | 1px `--color-border` |
| Inset tiles (inside cards) | `--radius-lg` (12px) | none | none |
| Buttons / inputs | `--radius-md` (8px) | none | 1px `--color-border` |
| Badges / pills | fully rounded | none | none |
| IVR flow nodes | `--radius-xl` (16px) | `--shadow-card` | tinted by node type |
| Popovers / menus | `--radius-2xl` (20px) | `--shadow-popover` | 1px `--color-border` |

**No gradients. No glass. No illustrations.** Depth comes from white-on-slate contrast, hairline borders, and the minimal shadow.

---

## Motion

- `transition-colors` on hover for nav and buttons — no bounces, no parallax.
- Spinner: `animate-spin` on the RefreshCcw icon during live-cockpit refresh.
- Sticky top bar: `bg-[var(--color-surface)]/95 backdrop-blur` — the only blur in the system.

---

## Iconography

**Library:** Lucide React — exclusively. Outline style, ~1.5px stroke, `currentColor`, 16px (`size-4`) in nav/badges, 20px (`size-5`) in stat tiles.

No emoji in the product UI. No custom SVG icons.

### Icon vocabulary (representative)

| Category | Icons |
|---|---|
| Nav | `LayoutDashboard`, `Building2`, `RadioTower`, `Phone`, `Hash`, `GitBranch`, `ArrowUpRight`, `PhoneCall`, `Workflow`, `ClipboardCheck`, `Mic`, `MonitorPlay`, `FileAudio`, `CalendarClock`, `Zap`, `AlertTriangle`, `ShieldCheck`, `TestTube2`, `ScanEye` |
| Status / runtime | `CheckCircle2`, `ShieldCheck`, `Rocket`, `Pencil`, `CircleOff`, `TriangleAlert`, `Activity`, `Wifi`, `WifiOff`, `Server`, `ServerOff`, `RefreshCcw`, `Clock` |
| IVR nodes | `PlayCircle` (start), `Volume2` (play prompt), `CircleDot` (collect), `GitBranch` (switch), `Clock3` (business hours), `Route` (caller-id match), `Tags` (set variable), `ArrowRightLeft` (transfer), `Equal` (queue), `Mail` (voicemail drop), `CircleStop` (hangup) |
| Brand chrome | `Shield` (in-app logo tile), `Bell`, `LogOut`, `ChevronRight` |

---

## Brand assets

Served from `apps/web/public/`:

| File | Use |
|---|---|
| `manageCallAILightBackground.svg` | Black mark, transparent bg — light surfaces |
| `manageCallAIDarkBackground.svg` | Cyan `#00d1d1` mark, transparent bg — dark surfaces |
| `manageCallAI.png` | Square avatar — used as browser favicon |
| `manageCallAI.jpg` | Square avatar — fallback / social |

The in-app logo lockup in the top bar uses a `Shield` Lucide icon in a 40×40px
dark (`--color-fg`) rounded tile paired with the "manageCallAI" wordmark — it does
not render the SVG brand mark directly.

---

## Component patterns

### DataCard

White card, 20px corners, `--shadow-card`, 1px border. Every information surface is
wrapped in a `DataCard`.

```tsx
<DataCard title="Extension Inventory" description="Live tenant-scoped data.">
  {/* table or empty state */}
</DataCard>
```

### StatCard

`DataCard` + a large metric value + a tinted icon tile. Used in 4-up stat rows above
data cards.

```tsx
<StatCard title="Active Sessions" value="3" icon={Activity} tone="tenant" />
```

### StatusBadge

Pill with Lucide icon. States: `active`, `inactive`, `draft`, `published`, `validated`, `warning`.

```tsx
<StatusBadge status="published" />
```

### Button

5 variants: `primary`, `secondary`, `outline`, `ghost`, `destructive`.

```tsx
<Button variant="secondary">
  <RefreshCcw className="size-4" />
  Refresh
</Button>
```

### PageHeader

Eyebrow + H1 + description + optional actions slot.

```tsx
<PageHeader
  eyebrow="Tenant Workspace"
  title="Live Cockpit"
  description="Near-real-time operational view..."
  actions={<Button variant="secondary">Refresh</Button>}
/>
```

### Empty state pattern

```tsx
<div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
  <p className="font-medium text-[var(--color-fg)]">No extensions yet</p>
  <p className="mt-2">Create your first extension to prove tenant registration...</p>
</div>
```

### Error state pattern

```tsx
<div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
  <p className="font-medium">Could not load data</p>
  <p className="mt-2">{errorMessage}</p>
</div>
```

### Input field

```tsx
<input
  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20"
/>
```

---

## Alpha/beta status surface

The `AlphaBanner` component (dismissible, `localStorage`-persisted) renders across
all authenticated pages while the product is pre-production:

```
⚠ Alpha software — not production-ready. Expect breaking changes. See alpha limitations.
```

This is intentional and must remain until the production evidence bundle is complete
and the product is promoted to a production release.

---

## References

- Design tokens: `apps/web/src/styles/tokens.css`
- App base styles: `apps/web/src/styles/app.css`
- Component source: `apps/web/src/components/`
- Feature pages: `apps/web/src/features/`
- UI architecture: `docs/ui/UI_ARCHITECTURE.md`
- Architecture overview: `docs/architecture/overview.md`
