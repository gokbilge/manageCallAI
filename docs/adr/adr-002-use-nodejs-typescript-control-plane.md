# ADR-002: Use Node.js + TypeScript for the Control Plane

## Status

Accepted

## Date

2026-05-26

## Context

The control plane must support REST APIs, workflow integrations, MCP integration, domain validation, publish orchestration, and general application development with high iteration speed.

The platform also benefits from a shared language across backend, frontend, and MCP-adjacent tooling.

## Decision

The main `manageCallAI` control plane backend will use Node.js + TypeScript.

This includes the primary API and business-logic application layer.

## Consequences

- The project gains a consistent TypeScript-based development model across major application surfaces.
- Shared types, validation schemas, and domain contracts become easier to reuse.
- Runtime-critical switch integration concerns may still use a different language when operationally justified.
- Backend architecture should be designed to preserve strong typing and explicit domain boundaries rather than relying on ad hoc JavaScript flexibility.

## Alternatives Considered

- Using Go for the main control plane backend
- Using a JVM-based backend stack
- Using Python for the main control plane backend

## Notes

This ADR applies specifically to the main control-plane application layer, not to every integration component in the system.
