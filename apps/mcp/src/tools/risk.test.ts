import { describe, it, expect } from 'vitest';
import { getToolRisk, TOOL_RISK_MAP } from './risk.js';

describe('getToolRisk', () => {
  it('returns read for read-only tools', () => {
    expect(getToolRisk('list_ivr_flows')).toBe('read');
    expect(getToolRisk('get_ivr_flow')).toBe('read');
    expect(getToolRisk('simulate_flow')).toBe('read');
    expect(getToolRisk('run_simulation_suite')).toBe('read');
    expect(getToolRisk('list_approvals')).toBe('read');
    expect(getToolRisk('list_recordings')).toBe('read');
    expect(getToolRisk('export_call_events')).toBe('read');
  });

  it('returns low for draft-only write tools', () => {
    expect(getToolRisk('create_ivr_flow')).toBe('low');
    expect(getToolRisk('update_flow_definition')).toBe('low');
    expect(getToolRisk('create_prompt')).toBe('low');
    expect(getToolRisk('update_prompt')).toBe('low');
    expect(getToolRisk('create_schedule')).toBe('low');
    expect(getToolRisk('update_schedule')).toBe('low');
    expect(getToolRisk('request_recording_analysis')).toBe('low');
  });

  it('returns medium for validate tools', () => {
    expect(getToolRisk('validate_flow')).toBe('medium');
  });

  it('returns high for publish and approval-decision tools', () => {
    expect(getToolRisk('request_publish')).toBe('high');
    expect(getToolRisk('decide_approval')).toBe('high');
    expect(getToolRisk('create_outbound_call')).toBe('high');
  });

  it('returns medium (default) for unknown tool names', () => {
    expect(getToolRisk('unknown_tool')).toBe('medium');
    expect(getToolRisk('')).toBe('medium');
    expect(getToolRisk('not_in_map')).toBe('medium');
  });

  it('covers every tool in TOOL_RISK_MAP', () => {
    for (const [tool, expected] of Object.entries(TOOL_RISK_MAP)) {
      expect(getToolRisk(tool)).toBe(expected);
    }
  });
});
