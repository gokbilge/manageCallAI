# Admin Tasks Guide

This guide is for admin users working in the manageCallAI web application after
the system is already installed.

It is not an installation guide. For first-time deployment, use
[setup-guide.md](../ops/setup-guide.md).

## 1. Who this guide is for

This guide is mainly for:

- tenant admins
- tenant operators with broad permissions
- platform admins who also need the platform workspace

What you can see depends on your role and capability set. Navigation in the web
app is permission-driven.

## 2. Workspaces

The current web app has two main workspaces.

### Tenant workspace

This is where most telecom administration happens.

Typical routes include:

- `/tenant/dashboard`
- `/tenant/cockpit`
- `/tenant/extensions`
- `/tenant/numbers`
- `/tenant/routes/inbound`
- `/tenant/routes/outbound`
- `/tenant/ivr-flows`
- `/tenant/conference-rooms`
- `/tenant/feature-codes`
- `/tenant/approvals`
- `/tenant/prompts`
- `/tenant/runtime/sessions`
- `/tenant/calls`
- `/tenant/recordings`
- `/tenant/schedules`
- `/tenant/webhooks`
- `/tenant/security-alerts`
- `/tenant/compliance`

### Platform workspace

This is available only to platform admins.

Current platform routes include:

- `/platform`
- `/platform/tenants`
- `/platform/runtime`

## 3. Signing in

After setup is complete:

1. Open the web app.
2. Sign in with your admin email and password.
3. You will usually land in the tenant workspace.
4. If you have platform permissions, you can switch into platform pages.

## 4. Common tenant admin tasks

## 4.1 Review the tenant dashboard

Start at:

- `/tenant/dashboard`
- `/tenant/cockpit`

Use these pages to:

- confirm the tenant is active
- review the live cockpit
- check whether there are active sessions, runtime noise, or recent failures
- review the triage queue for degraded gateways, failed webhooks, and failed calls
- inspect gateway registration state without switching into the trunk management page

If the cockpit looks empty, that may simply mean there is no recent runtime
activity yet.

## 4.2 Create and manage extensions

Go to:

- `/tenant/extensions`

Use this page to:

- create internal extensions
- set display names
- assign SIP credentials
- review existing extension inventory

Typical sequence:

1. create an extension
2. give it a recognizable display name
3. use it later in routes, queues, or IVR targets

## 4.3 Add phone numbers

Go to:

- `/tenant/numbers`

Use this page to:

- add DIDs or other phone numbers
- label numbers by purpose
- deactivate unused numbers

Usually you will create numbers before building inbound routes.

## 4.4 Configure inbound routes

Go to:

- `/tenant/routes/inbound`

Use this page to:

- connect a number to a destination
- activate or deactivate routes
- review current inbound route state

Typical sequence:

1. create or choose a phone number
2. choose a target
3. save the route
4. activate it when ready

## 4.5 Configure outbound routes

Go to:

- `/tenant/routes/outbound`

Use this page to:

- define outbound dialing behavior
- control which trunks and destination patterns are used
- review route state before operators start placing outbound calls

## 4.6 Review or place outbound calls

Go to:

- `/tenant/outbound-calls`

Use this page to:

- review outbound call activity
- verify that route and policy behavior is working as expected

## 4.7 Build and publish IVR flows

Go to:

- `/tenant/ivr-flows`

Use these pages to:

- create IVR flows
- edit flow definitions
- validate changes
- simulate behavior
- publish or roll back versions where allowed

This is one of the main admin workflows in the product.

Recommended sequence:

1. create the flow
2. edit the flow definition
3. validate it
4. simulate expected behavior
5. publish when the result looks correct

If the tenant requires approvals, publish may create an approval request instead
of activating immediately.

## 4.8 Handle approvals

Go to:

- `/tenant/approvals`

Use this page to:

- review pending approval items
- approve or reject changes when your role allows it

This is usually used for publish-sensitive actions such as IVR lifecycle changes.

## 4.9 Manage conference rooms

Go to:

- `/tenant/conference-rooms`

Use this page to:

- create conference rooms backed by `mod_conference`
- review room number, PIN posture, and participant limits
- inspect live participant visibility when runtime callbacks are present
- enable, disable, or delete rooms according to your role

The room number is a live routing target. Treat changes to conference rooms with
the same care as any inbound routing destination.

## 4.10 Manage feature codes

Go to:

- `/tenant/feature-codes`

Use this page to:

- create draft DTMF feature codes
- validate before publish
- publish, disable, or delete according to your role
- surface emergency-number conflicts before they reach runtime

Active and disabled feature codes are immutable in the current lifecycle. To
change live behavior, create a replacement draft and publish it intentionally.

## 4.11 Manage prompts

Go to:

- `/tenant/prompts`

Use this page to:

- manage prompt assets
- review prompt inventory used by IVR or voicemail workflows

## 4.12 Review runtime sessions

Go to:

- `/tenant/runtime/sessions`

Use this page to:

- inspect IVR runtime sessions
- review individual session detail pages
- troubleshoot call-flow behavior after a live interaction

This is useful when a published IVR behaves differently than expected.

## 4.13 Review call events and recordings

Go to:

- `/tenant/calls`
- `/tenant/recordings`

Use these pages to:

- review recent call activity
- inspect CDR-style call summaries grouped by call
- filter by direction, outcome, number, or failure reason
- inspect normalized call events for the selected call
- review recording inventory where enabled

## 4.14 Manage schedules

Go to:

- `/tenant/schedules`

Use this page to:

- create business-time schedules
- support time-based routing behavior

## 4.15 Manage webhooks and automation

Go to:

- `/tenant/webhooks`

Use this page to:

- configure outbound event delivery
- support workflow automation and external integrations

## 4.16 Review security and compliance pages

Go to:

- `/tenant/security-alerts`
- `/tenant/compliance`

Use these pages to:

- review security alerts
- inspect retention or compliance-related controls available to your role

## 4.17 Run the directory smoke test

Go to:

- `/tenant/integrations/directory-smoke-test`

Use this page to:

- verify directory integration behavior
- check whether the application and FreeSWITCH integration path is responding as expected

## 5. Platform admin tasks

If you are a platform admin, you also have platform pages.

## 5.1 View the platform overview

Go to:

- `/platform`

Use this page to:

- review the platform summary
- confirm the control plane is reachable

## 5.2 Review tenants

Go to:

- `/platform/tenants`

Use this page to:

- review tenant inventory
- inspect tenant-level platform visibility

## 5.3 Review runtime health

Go to:

- `/platform/runtime`

Use this page to:

- inspect FreeSWITCH runtime visibility
- review node health and operational state exposed by the platform

## 6. Recommended admin workflow

For a new tenant, a practical order is:

1. confirm login and workspace access
2. create extensions
3. add phone numbers
4. configure inbound routes
5. configure outbound routes
6. create prompts
7. build IVR flows
8. validate and simulate
9. publish
10. review sessions, calls, and recordings after live traffic starts

## 7. Common admin limits

- Some pages will not appear unless your role includes the required capability.
- Platform pages are not available to normal tenant users.
- Publish actions may create approval requests instead of activating immediately.
- Runtime views can look empty when there is no recent traffic.

## 8. Related guides

- [setup-guide.md](../ops/setup-guide.md)
- [quickstart.md](../ops/quickstart.md)
- [UI_ARCHITECTURE.md](../ui/UI_ARCHITECTURE.md)
- [end-user-self-service.md](../pbx/end-user-self-service.md)
- [end-user-self-service.md](end-user-self-service.md)
