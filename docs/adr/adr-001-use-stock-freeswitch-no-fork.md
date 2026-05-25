# ADR-001: Use Stock FreeSWITCH, No Fork

## Status

Accepted

## Date

2026-05-26

## Context

`manageCallAI` needs a mature telecom runtime for SIP signaling, media handling, and call execution, but the project goal is to build a safe control plane above that runtime rather than maintaining a custom telecom engine distribution.

Forking FreeSWITCH would increase maintenance burden, reduce upgrade compatibility, and slow adoption by requiring users to replace or distrust their existing deployments.

## Decision

`manageCallAI` will use stock FreeSWITCH and will not fork or replace it.

Integration will occur only through supported extension interfaces such as `mod_xml_curl`, `ESL` / `mod_event_socket`, and minimal Lua helper scripts.

## Consequences

- Existing FreeSWITCH users can adopt the platform without replacing their runtime.
- The project avoids long-term fork maintenance and custom runtime divergence.
- Runtime integration behavior must stay within FreeSWITCH-supported extension boundaries.
- Project-specific orchestration logic must remain outside FreeSWITCH itself.

## Alternatives Considered

- Forking FreeSWITCH and embedding project-specific behavior directly into the runtime
- Replacing FreeSWITCH with a custom telecom execution layer

## Notes

This ADR supersedes [ADR-0001](adr-0001-freeswitch-remains-runtime.md) as the more precise technology decision for runtime strategy.
