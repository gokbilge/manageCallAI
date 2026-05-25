# ADR-0003: Business-Level APIs Over Low-Level Telecom Primitives

## Status

Accepted

## Date

2026-05-26

## Context

The product exists to reduce telecom-specific operational complexity for administrators, workflows, and AI agents.

If the public interface is modeled around raw dialplan fragments, arbitrary XML payloads, or unrestricted switch-level commands, the platform would fail its core safety and usability goals.

## Decision

Public interfaces in `manageCallAI` will be modeled around business objects and business actions rather than low-level FreeSWITCH primitives.

Examples include extensions, routes, prompts, flows, validations, simulations, and publishes instead of raw dialplan or command passthrough operations.

## Consequences

- API, UI, MCP, and workflow consumers can use one stable domain vocabulary.
- Validation and policy enforcement can occur at the business-operation layer.
- Some advanced low-level capabilities may not be exposed directly, which is intentional.
- Adapter layers must absorb the complexity of translating business objects into runtime artifacts.

## Alternatives Considered

- Exposing raw dialplan fragments as a first-class API model
- Providing a general-purpose switch command passthrough API

## Notes

This decision is central to both safety and AI compatibility.
