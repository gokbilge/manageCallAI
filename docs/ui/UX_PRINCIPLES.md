# manageCallAI UX Principles

## 1. Purpose

This document defines the product UX principles for manageCallAI.

The UI must make telecom operations understandable, safe, and reversible for:

- Human administrators
- Workflow operators
- AI-assisted users
- Platform maintainers

## 2. Design Inspiration

manageCallAI should combine:

- **Apple-like clarity**
  - calm surfaces
  - simple hierarchy
  - minimal visible complexity
  - direct manipulation where useful
- **IBM/Carbon-like enterprise discipline**
  - dense but readable data views
  - strong accessibility
  - clear system status
  - predictable components
  - audit-friendly workflows

The visual direction should be calm, technical, and trustworthy, not playful SaaS.

## 3. Core UX Principles

### 3.1 Safety Before Speed

Telecom changes can break production calls.

Dangerous actions must be explicit:

- publish
- rollback
- route override
- trunk changes
- outbound policy changes
- runtime token rotation
- AI tool permission changes

Use confirmation, impact summaries, and audit records.

### 3.2 Desired State Is Primary

Users should manage business intent, not FreeSWITCH internals.

Good labels:

```text
Main IVR
Sales Queue
Business Hours Route
Published Version
Simulation Passed
Rollback Target
```

Avoid exposing first-class raw concepts like:

```text
XML fragment
ESL command
dialplan regex
sofia profile internals
```

unless inside advanced/debug panels.

### 3.3 Every Risky Change Has a Lifecycle

A publishable change should move through:

- Draft
- Validated
- Simulated
- Approved
- Published
- Rolled back

The UI should always show the current lifecycle state.

### 3.4 AI Is an Actor, Not Magic

AI-generated actions must be visible and accountable.

Show:

- which agent acted
- what tool was used
- what changed
- whether a human approved it
- what validation/simulation found
- rollback path

### 3.5 Make Runtime Observable

A telecom platform must explain what happened.

Every call should have a readable timeline:

```text
Incoming call from +90...
Matched inbound route: Main Number
Entered flow: Main IVR v4
Played prompt: welcome_tr
Collected digit: 2
Transferred to: Support Queue
Hung up after 01:42
```

Raw runtime payloads may exist, but they should be secondary.

### 3.6 Progressive Disclosure

Default screens should show business-level information.

Advanced details should be available but hidden behind:

- expandable panels
- debug drawers
- advanced tabs
- raw event viewers

### 3.7 Consistency Over Cleverness

Use the same patterns everywhere:

- list page
- detail page
- edit drawer
- validation panel
- publish panel
- audit timeline
- destructive action confirmation

Do not invent custom UI for each telecom object.

### 3.8 Reversibility Builds Trust

Where possible, every production-impacting operation should show:

- current active version
- proposed version
- previous version
- rollback action
- audit record

## 4. Interaction Rules

### 4.1 Button Hierarchy

Use:

- Primary: main positive action
- Secondary: neutral action
- Destructive: irreversible/risky action
- Ghost: low-emphasis contextual action

Examples:

- Primary: Validate, Simulate, Create Extension
- Secondary: Save Draft, Cancel
- Destructive: Delete, Disable, Revoke Token
- Ghost: View Raw Event

Publishing should often be separated from normal primary actions.

### 4.2 Confirmation Rules

Require confirmation for:

- publish
- rollback
- delete
- disable extension
- rotate runtime token
- enable AI publish permissions
- outbound route changes
- trunk credential changes

Do not require confirmation for:

- saving draft
- opening details
- filtering
- simulation
- validation

### 4.3 Empty States

Every empty state should answer:

- What is this?
- Why is it empty?
- What can I do next?

Example:

```text
No IVR flows yet.
Create your first call flow to route inbound calls through prompts, digit collection, and transfers.
[Create Flow]
```

### 4.4 Error Messages

Errors must be:

- specific
- actionable
- non-telecom-jargon-first
- traceable with request ID where possible

Bad:

```text
ESL failure
```

Good:

```text
Could not connect to FreeSWITCH event socket.
Check FREESWITCH_ESL_HOST, port 8021, and the runtime token configuration.
```

## 5. Accessibility Principles

Minimum requirements:

- keyboard navigation
- visible focus rings
- semantic headings
- ARIA labels for icon-only buttons
- sufficient contrast
- no color-only status meaning
- readable table interactions
- accessible modals/drawers
- reduced motion support

Status must use icon + text + color, not color alone.

## 6. UX Rules for Telecom Objects

### Extensions

Users care about:

- number
- display name
- SIP username
- status
- default destination
- registration/call activity later

Do not show SIP password after creation.

### Routes

Users care about:

- match rule
- target
- status
- active version
- validation state

Always provide a test/simulate option.

### Flows

Users care about:

- draft vs active version
- node graph
- validation errors
- simulation path
- publish impact
- rollback

Flow builder must support visual debugging.

### Runtime Events

Users care about:

- call identity
- caller/callee
- business route matched
- flow entered
- outcome
- duration
- failure reason

Raw event payload should be expandable.

## 7. UX Anti-Patterns

Avoid:

- raw FreeSWITCH-first UI
- hidden production-impacting saves
- publish without simulation
- AI actions without audit
- giant forms with no grouping
- color-only status
- unclear tenant context
- unscoped platform/tenant navigation
