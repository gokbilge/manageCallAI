import { describe, it, expect } from 'vitest';
import { APPROVAL_TOOLS } from './tools/approvals.js';
import { EXPORT_TOOLS } from './tools/exports.js';
import { IVR_FLOW_TOOLS } from './tools/ivr-flows.js';
import { PROMPT_TOOLS } from './tools/prompts.js';
import { RECORDING_TOOLS } from './tools/recordings.js';
import { RUNTIME_TOOLS } from './tools/runtime.js';
import { SCHEDULE_TOOLS } from './tools/schedules.js';

const ALL_TOOLS = [
  ...IVR_FLOW_TOOLS,
  ...APPROVAL_TOOLS,
  ...PROMPT_TOOLS,
  ...RUNTIME_TOOLS,
  ...SCHEDULE_TOOLS,
  ...RECORDING_TOOLS,
  ...EXPORT_TOOLS,
];

// Dispatch sets as defined in index.ts — the router checks these in order
const APPROVAL_NAMES = new Set<string>(APPROVAL_TOOLS.map((t) => t.name));
const PROMPT_NAMES = new Set<string>(PROMPT_TOOLS.map((t) => t.name));
const RUNTIME_NAMES = new Set<string>(RUNTIME_TOOLS.map((t) => t.name));
const SCHEDULE_NAMES = new Set<string>(SCHEDULE_TOOLS.map((t) => t.name));
const RECORDING_NAMES = new Set<string>(RECORDING_TOOLS.map((t) => t.name));
const EXPORT_NAMES = new Set<string>(EXPORT_TOOLS.map((t) => t.name));
const IVR_NAMES = new Set<string>(IVR_FLOW_TOOLS.map((t) => t.name));

const ALL_DISPATCH_NAMES = [
  APPROVAL_NAMES,
  PROMPT_NAMES,
  RUNTIME_NAMES,
  SCHEDULE_NAMES,
  RECORDING_NAMES,
  EXPORT_NAMES,
  IVR_NAMES,
] as const;

describe('MCP server dispatch completeness', () => {
  it('ALL_TOOLS contains no duplicate names', () => {
    const names = ALL_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('every tool in ALL_TOOLS is covered by exactly one dispatch group', () => {
    for (const tool of ALL_TOOLS) {
      const coveredBy = ALL_DISPATCH_NAMES.filter((group) => group.has(tool.name));
      expect(
        coveredBy.length,
        `Tool "${tool.name}" must be in exactly one dispatch group, found ${coveredBy.length}`,
      ).toBe(1);
    }
  });

  it('no tool name appears in more than one dispatch group', () => {
    const seen = new Map<string, number>();
    for (const group of ALL_DISPATCH_NAMES) {
      for (const name of group) {
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
    }
    for (const [name, count] of seen) {
      expect(count, `Tool "${name}" appears in ${count} dispatch groups`).toBe(1);
    }
  });

  it('union of all dispatch groups equals ALL_TOOLS', () => {
    const dispatchCoverage = new Set<string>();
    for (const group of ALL_DISPATCH_NAMES) {
      for (const name of group) {
        dispatchCoverage.add(name);
      }
    }
    const allNames = new Set(ALL_TOOLS.map((t) => t.name));
    expect(dispatchCoverage).toEqual(allNames);
  });

  it('all tools carry an inputSchema with a type field', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema, `${tool.name} must have inputSchema`).toBeTruthy();
      expect(
        (tool.inputSchema as Record<string, unknown>)['type'],
        `${tool.name}.inputSchema must have a type field`,
      ).toBeTruthy();
    }
  });

  it('all tool names follow snake_case identifier convention', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('all tool descriptions are non-empty', () => {
    for (const tool of ALL_TOOLS) {
      expect(
        tool.description.length,
        `${tool.name} description should be at least 10 chars`,
      ).toBeGreaterThan(10);
    }
  });

  it('no tool schema property is named access_token', () => {
    function hasAccessToken(schema: unknown): boolean {
      if (typeof schema !== 'object' || schema === null) return false;
      const s = schema as Record<string, unknown>;
      if ('properties' in s && typeof s['properties'] === 'object') {
        const props = s['properties'] as Record<string, unknown>;
        if ('access_token' in props) return true;
      }
      return false;
    }

    for (const tool of ALL_TOOLS) {
      expect(
        hasAccessToken(tool.inputSchema),
        `${tool.name} must not expose access_token in its schema`,
      ).toBe(false);
    }
  });
});
