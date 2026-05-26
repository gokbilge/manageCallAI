# ADR-0007: UI Surfaces and Design System

## Status

Accepted

## Context

`manageCallAI` needs an MVP frontend that supports both platform operators and tenant administrators without fragmenting the early product into multiple web applications.

The frontend also needs a stable component and styling direction that can support:

- enterprise operational density
- telecom lifecycle state
- auditability
- AI/workflow transparency
- future visual IVR building

The project already standardizes on React + TypeScript for the frontend. The missing decision is how to structure the operator surfaces and what UI foundation to use.

## Decision

`manageCallAI` will use one React app with two workspaces:

1. Platform Management
2. Tenant Admin

Both workspaces will live inside `apps/web` and share:

- routing
- auth/session handling
- permission-aware navigation
- design tokens
- component primitives
- iconography

The MVP frontend stack will be:

- React
- TypeScript
- Vite
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui-style primitives
- Lucide React
- React Flow for the visual IVR builder

Tailwind is the token-to-utility layer. Design tokens such as color, font, spacing, radius, shadows, and breakpoints will be defined centrally and surfaced through Tailwind theme variables.

Lucide React is the default icon set because it is lightweight, consistent, open source, and React-native.

## Consequences

Positive:

- avoids premature frontend fragmentation
- keeps platform and tenant experiences consistent
- enables one shared design system and permission model
- supports enterprise-style data views and future flow-builder UX
- keeps the MVP delivery surface smaller

Tradeoffs:

- route and permission boundaries must be disciplined
- one app must clearly expose workspace context in the URL and layout
- component primitives must be designed for both dense admin pages and visual builder screens

Follow-on rules:

- workspace state must be explicit in the URL
- backend authorization remains authoritative
- dangerous telecom actions must preserve explicit lifecycle UX
- iconography supports labels, not replaces them

## References

- [docs/ui/UI_ARCHITECTURE.md](../ui/UI_ARCHITECTURE.md)
- [docs/ui/UX_PRINCIPLES.md](../ui/UX_PRINCIPLES.md)
- [docs/ui/DESIGN_SYSTEM.md](../ui/DESIGN_SYSTEM.md)
- [docs/ui/ICONOGRAPHY.md](../ui/ICONOGRAPHY.md)
