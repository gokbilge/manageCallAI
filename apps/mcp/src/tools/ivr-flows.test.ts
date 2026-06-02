import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiResponse } from '../api-client.js';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  apiKey: 'test-key',
}));

import { apiCall } from '../api-client.js';
import { handleTool } from './ivr-flows.js';

const mockApiCall = vi.mocked(apiCall);

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, status: 200, data };
}

function fail<T>(status: number, data: T): ApiResponse<T> {
  return { ok: false, status, data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('list_ivr_flows', () => {
  it('returns serialized data on success', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: [{ id: 'f1', name: 'Main' }] }));
    const result = await handleTool('list_ivr_flows', {});
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain('f1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/ivr-flows');
  });

  it('returns error on API failure', async () => {
    mockApiCall.mockResolvedValueOnce(fail(500, { message: 'internal' }));
    const result = await handleTool('list_ivr_flows', {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain('500');
  });
});

describe('get_ivr_flow', () => {
  it('calls correct path with flow_id', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { id: 'abc' } }));
    const result = await handleTool('get_ivr_flow', { flow_id: 'abc' });
    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/ivr-flows/abc');
  });

  it('returns error when the API denies lookup', async () => {
    mockApiCall.mockResolvedValueOnce(fail(404, { message: 'not found' }));
    const result = await handleTool('get_ivr_flow', { flow_id: 'missing' });
    expect(result).toEqual({ text: 'API error 404: {"message":"not found"}', isError: true });
  });
});

describe('create_ivr_flow', () => {
  it('posts name only when no optional fields', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { id: 'new' } }));
    await handleTool('create_ivr_flow', { name: 'Test Flow' });
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/v1/ivr-flows', { name: 'Test Flow' });
  });

  it('includes description and definition when provided', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: {} }));
    const def = { nodes: [], edges: [] };
    await handleTool('create_ivr_flow', { name: 'T', description: 'desc', definition: def });
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/v1/ivr-flows', {
      name: 'T',
      description: 'desc',
      definition: def,
    });
  });

  it('returns error when create is rejected', async () => {
    mockApiCall.mockResolvedValueOnce(fail(400, { message: 'invalid graph' }));
    const result = await handleTool('create_ivr_flow', { name: 'Broken' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('invalid graph');
  });
});

describe('update_flow_definition', () => {
  it('patches the correct version path', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: {} }));
    const def = { nodes: [{ id: 'n1' }], edges: [], entry_node_id: 'n1' };
    await handleTool('update_flow_definition', { flow_id: 'f1', version_id: 'v1', definition: def });
    expect(mockApiCall).toHaveBeenCalledWith(
      'PATCH',
      '/api/v1/ivr-flows/f1/versions/v1',
      { definition: def },
    );
  });

  it('returns error when draft update fails', async () => {
    mockApiCall.mockResolvedValueOnce(fail(409, { message: 'version locked' }));
    const result = await handleTool('update_flow_definition', { flow_id: 'f1', version_id: 'v1', definition: {} });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('409');
  });
});

describe('validate_flow', () => {
  it('returns non-error on 200', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { passed: true } }));
    const result = await handleTool('validate_flow', { flow_id: 'f1' });
    expect(result.isError).toBeFalsy();
  });

  it('returns soft isError on 422 (validation failure)', async () => {
    mockApiCall.mockResolvedValueOnce(fail(422, { data: { passed: false, errors: ['missing entry'] } }));
    const result = await handleTool('validate_flow', { flow_id: 'f1' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('missing entry');
  });

  it('returns hard error on 500', async () => {
    mockApiCall.mockResolvedValueOnce(fail(500, { message: 'oops' }));
    const result = await handleTool('validate_flow', { flow_id: 'f1' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('API error 500');
  });
});

describe('simulate_flow', () => {
  it('sends optional fields when provided', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { path: [] } }));
    await handleTool('simulate_flow', {
      flow_id: 'f1',
      caller_number: '+14155550001',
      digits: ['1'],
      collected_digits: '12',
      now: '2026-01-01T09:00:00Z',
      force_timeout: true,
      force_timeout_nodes: ['collect'],
      force_invalid: true,
      force_invalid_nodes: ['menu'],
      variables: { tier: 'gold' },
    });
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/v1/ivr-flows/f1/simulate', {
      caller_number: '+14155550001',
      digits: ['1'],
      collected_digits: '12',
      now: '2026-01-01T09:00:00Z',
      force_timeout: true,
      force_timeout_nodes: ['collect'],
      force_invalid: true,
      force_invalid_nodes: ['menu'],
      variables: { tier: 'gold' },
    });
  });

  it('sends empty body when no optional fields', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: {} }));
    await handleTool('simulate_flow', { flow_id: 'f1' });
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/v1/ivr-flows/f1/simulate', {});
  });

  it('returns soft isError on 422', async () => {
    mockApiCall.mockResolvedValueOnce(fail(422, { data: { error: 'dead end' } }));
    const result = await handleTool('simulate_flow', { flow_id: 'f1' });
    expect(result.isError).toBe(true);
  });

  it('returns hard error on non-validation API failures', async () => {
    mockApiCall.mockResolvedValueOnce(fail(500, { message: 'runtime unavailable' }));
    const result = await handleTool('simulate_flow', { flow_id: 'f1' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('API error 500');
  });
});

describe('request_publish', () => {
  it('posts to the publish endpoint', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { status: 'published' } }));
    const result = await handleTool('request_publish', { flow_id: 'f1', version_id: 'v1' });
    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith(
      'POST',
      '/api/v1/ivr-flows/f1/versions/v1/publish',
    );
  });

  it('returns error on failure', async () => {
    mockApiCall.mockResolvedValueOnce(fail(403, { message: 'forbidden' }));
    const result = await handleTool('request_publish', { flow_id: 'f1', version_id: 'v1' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('403');
  });
});

describe('unknown tool', () => {
  it('returns isError for unrecognised tool name', async () => {
    const result = await handleTool('does_not_exist', {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain('does_not_exist');
  });
});

describe('run_simulation_suite', () => {
  it('runs multiple labeled scenarios and returns a passed suite', async () => {
    mockApiCall
      .mockResolvedValueOnce(ok({ outcome: { status: 'passed', path: ['start', 'sales'], final_action: { type: 'transfer' }, errors: [] } }))
      .mockResolvedValueOnce(ok({ outcome: { status: 'passed', path: ['start', 'support'], final_action: null, errors: [] } }));

    const result = await handleTool('run_simulation_suite', {
      flow_id: 'f1',
      scenarios: [
        { label: 'sales path', caller_number: '+14155550001', digits: ['1'], now: '2026-01-01T09:00:00Z' },
        { digits: ['2'] },
      ],
    });

    expect(result.isError).toBe(false);
    expect(result.text).toContain('"suite_status": "passed"');
    expect(result.text).toContain('"label": "sales path"');
    expect(result.text).toContain('"label": "scenario_2"');
    expect(mockApiCall).toHaveBeenNthCalledWith(1, 'POST', '/api/v1/ivr-flows/f1/simulate', {
      caller_number: '+14155550001',
      digits: ['1'],
      now: '2026-01-01T09:00:00Z',
    });
    expect(mockApiCall).toHaveBeenNthCalledWith(2, 'POST', '/api/v1/ivr-flows/f1/simulate', {
      digits: ['2'],
    });
  });

  it('marks the suite failed for validation failures and hard API errors', async () => {
    mockApiCall
      .mockResolvedValueOnce(fail(422, { outcome: { status: 'failed', path: ['start'], final_action: null, errors: ['bad input'] } }))
      .mockResolvedValueOnce(fail(503, { message: 'unavailable' }));

    const result = await handleTool('run_simulation_suite', {
      flow_id: 'f1',
      scenarios: [{ label: 'invalid' }, { label: 'api down' }],
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('"suite_status": "failed"');
    expect(result.text).toContain('"status": "failed"');
    expect(result.text).toContain('"status": "error"');
    expect(result.text).toContain('unavailable');
  });

  it('handles missing scenario arrays as an empty passing suite', async () => {
    const result = await handleTool('run_simulation_suite', { flow_id: 'f1', scenarios: 'not-array' });
    expect(result.isError).toBe(false);
    expect(result.text).toContain('"suite_status": "passed"');
    expect(mockApiCall).not.toHaveBeenCalled();
  });
});
