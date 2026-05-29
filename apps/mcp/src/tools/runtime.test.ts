import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiResponse } from '../api-client.js';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  apiKey: 'test-key',
}));

import { apiCall } from '../api-client.js';
import { handleRuntimeTool } from './runtime.js';

const mockApiCall = vi.mocked(apiCall);

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, status: 200, data };
}
function fail<T>(status: number, data: T): ApiResponse<T> {
  return { ok: false, status, data };
}

beforeEach(() => vi.clearAllMocks());

describe('list_sessions', () => {
  it('fetches all sessions without filter', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: [{ id: 's1' }] }));
    const result = await handleRuntimeTool('list_sessions', {});
    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/runtime/ivr/sessions');
  });

  it('appends status filter when provided', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: [] }));
    await handleRuntimeTool('list_sessions', { status: 'running' });
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/runtime/ivr/sessions?status=running');
  });

  it('returns error on API failure', async () => {
    mockApiCall.mockResolvedValueOnce(fail(500, {}));
    const result = await handleRuntimeTool('list_sessions', {});
    expect(result.isError).toBe(true);
  });
});

describe('get_session', () => {
  it('fetches session replay by id', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { session: { id: 's1' }, steps: [] } }));
    const result = await handleRuntimeTool('get_session', { session_id: 's1' });
    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/runtime/ivr/sessions/s1');
  });
});
