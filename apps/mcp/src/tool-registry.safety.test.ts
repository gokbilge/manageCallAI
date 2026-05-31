import { describe, expect, it } from 'vitest';
import { APPROVAL_TOOLS } from './tools/approvals.js';
import { EXPORT_TOOLS } from './tools/exports.js';
import { IVR_FLOW_TOOLS } from './tools/ivr-flows.js';
import { PROMPT_TOOLS } from './tools/prompts.js';
import { RECORDING_TOOLS } from './tools/recordings.js';
import { RUNTIME_TOOLS } from './tools/runtime.js';
import { SCHEDULE_TOOLS } from './tools/schedules.js';
import { getToolRisk } from './tools/risk.js';

const ALL_TOOLS = [
  ...IVR_FLOW_TOOLS,
  ...APPROVAL_TOOLS,
  ...PROMPT_TOOLS,
  ...RUNTIME_TOOLS,
  ...SCHEDULE_TOOLS,
  ...RECORDING_TOOLS,
  ...EXPORT_TOOLS,
];

function stringifySchema(schema: unknown): string {
  return JSON.stringify(schema).toLowerCase();
}

describe('MCP tool registry safety', () => {
  it('gives every tool a name, description, input schema, and risk category', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toBeTruthy();
      expect(['read', 'low', 'medium', 'high']).toContain(getToolRisk(tool.name));
    }
  });

  it('does not expose access tokens or raw runtime command surfaces', () => {
    for (const tool of ALL_TOOLS) {
      const haystack = `${tool.name} ${tool.description} ${stringifySchema(tool.inputSchema)}`;

      expect(haystack).not.toMatch(/access_token/);
      expect(haystack).not.toMatch(/\besl\b.*command|command.*\besl\b/);
      expect(haystack).not.toMatch(/raw xml|xml edit|\bshell\b|\bexec\b|\bbash\b|\bpowershell\b/);
    }
  });

  it('keeps AI mutations on safe lifecycle tools instead of direct runtime controls', () => {
    const toolNames = new Set<string>(ALL_TOOLS.map((tool) => tool.name));

    expect(toolNames.has('publish_now')).toBe(false);
    expect(toolNames.has('raw_esl_command')).toBe(false);
    expect(toolNames.has('raw_xml_update')).toBe(false);
    expect(toolNames.has('shell_command')).toBe(false);
    expect(toolNames.has('request_publish')).toBe(true);
    expect(getToolRisk('request_publish')).toBe('high');
  });
});
