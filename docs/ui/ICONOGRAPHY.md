# manageCallAI Iconography

## 1. Purpose

This document defines icon usage for manageCallAI.

Icons must improve scanning and status recognition. They must not replace labels in critical telecom workflows.

## 2. Icon Library

Use:

```text
lucide-react
```

Why:

- React-native package
- consistent line icon style
- broad icon set
- lightweight
- works well with Tailwind
- suitable for enterprise UI

Lucide provides a React package specifically for using its icons in React projects.

## 3. Installation

```bash
pnpm add lucide-react --filter @managecallai/web
```

Example:

```tsx
import { PhoneCall, Route, Workflow } from "lucide-react";

export function Example() {
  return (
    <div className="flex items-center gap-2">
      <PhoneCall className="size-4" aria-hidden="true" />
      <span>Calls</span>
    </div>
  );
}
```

## 4. Icon Rules

### 4.1 Always Pair Icons With Text for Primary Navigation

Good:

```text
[Phone icon] Calls
[Workflow icon] Flows
```

Bad:

```text
[Icon only]
```

Icon-only buttons must have accessible labels.

```tsx
<button aria-label="Delete extension">
  <Trash2 className="size-4" aria-hidden="true" />
</button>
```

### 4.2 Icon Sizes

Use:

- Navigation: `size-4` or `size-5`
- Buttons: `size-4`
- Status badges: `size-3.5`
- Empty states: `size-8` or `size-10`
- Flow nodes: `size-4`
- Hero/marketing later: `size-12`

### 4.3 Stroke Width

Default Lucide stroke is usually acceptable.

Recommended:

- Normal UI: default
- Small badges: default or `2`
- Large empty states: `1.75` or `2`

Do not mix filled and outline icon styles unless intentionally creating status contrast.

## 5. Recommended Icon Map

### Platform

- Platform dashboard: `LayoutDashboard`
- Tenants: `Building2`
- Runtime nodes: `Server`
- FreeSWITCH: `RadioTower`
- Agents: `Bot`
- System events: `Activity`
- Audit: `ShieldCheck`
- Settings: `Settings`
- Feature flags: `ToggleLeft`

### Tenant

- Tenant dashboard: `LayoutDashboard`
- Extensions: `Phone`
- SIP devices: `Headset`
- Numbers/DIDs: `Hash`
- Inbound routes: `Route`
- Outbound routes: `Send`
- Prompts: `Volume2`
- Flows: `Workflow`
- Calls: `PhoneCall`
- CDRs: `ListChecks`
- Audit: `FileClock`
- Users: `Users`
- Roles/permissions: `Shield`
- n8n integration: `Network`
- MCP/AI tools: `Bot`

### Flow Builder

- Start: `PlayCircle`
- Play Prompt: `Volume2`
- Collect Digits: `Keyboard`
- Condition: `GitBranch`
- Business Hours: `Clock`
- Transfer: `ArrowRightLeft`
- Queue: `ListOrdered`
- Voicemail: `Voicemail`
- Webhook: `Webhook`
- AI Action: `Bot`
- End: `StopCircle`
- Error/Fallback: `TriangleAlert`

### Status

- Active: `CheckCircle2`
- Inactive: `CircleOff`
- Draft: `Pencil`
- Validated: `ShieldCheck`
- Simulation Passed: `CircleCheck`
- Simulation Failed: `CircleX`
- Approval Required: `UserCheck`
- Published: `Rocket`
- Rollback: `RotateCcw`
- Warning: `TriangleAlert`
- Error: `CircleAlert`
- Info: `Info`

## 6. Accessibility

Rules:

- Decorative icons use `aria-hidden="true"`.
- Icon-only buttons require `aria-label`.
- Status must not rely on color alone.
- Pair status icons with readable text.
- Tooltips should supplement, not replace labels.

## 7. Icon Component Wrapper

Create:

```text
apps/web/src/components/ui/icon.tsx
```

Example:

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type IconProps = {
  icon: LucideIcon;
  label?: string;
  className?: string;
  decorative?: boolean;
};

export function Icon({ icon: IconComponent, label, className, decorative = true }: IconProps) {
  return (
    <IconComponent
      className={cn("size-4 shrink-0", className)}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={!decorative ? label : undefined}
    />
  );
}
```

## 8. Do Not Use Icons For

Avoid icon-only communication for:

- publish impact
- validation errors
- route destination
- destructive actions
- AI-generated changes
- permission state
- tenant identity

Use icons as supporting visual cues only.
