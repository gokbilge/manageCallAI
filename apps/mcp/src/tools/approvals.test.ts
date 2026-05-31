import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ApiResponse } from '../api-client.js';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
  apiKey: 'test-key',
}));

import { apiCall } from '../api-client.js';
import { handleApprovalTool } from './approvals.js';

const mockApiCall = vi.mocked(apiCall);

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, status: 200, data };
}
function fail<T>(status: number, data: T): ApiResponse<T> {
  return { ok: false, status, data };
}

beforeEach(() => vi.clearAllMocks());

describe('list_approvals', () => {
  it('returns all approvals without filter', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: [{ id: 'a1' }] }));
    const result = await handleApprovalTool('list_approvals', {});
    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/approvals');
  });

  it('appends status query param when provided', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: [] }));
    await handleApprovalTool('list_approvals', { status: 'pending' });
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/approvals?status=pending');
  });

  it('returns error on API failure', async () => {
    mockApiCall.mockResolvedValueOnce(fail(403, { error: 'forbidden' }));
    const result = await handleApprovalTool('list_approvals', {});
    expect(result.isError).toBe(true);
  });
});

describe('get_approval', () => {
  it('calls correct path with approval_id', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { id: 'a1' } }));
    const result = await handleApprovalTool('get_approval', { approval_id: 'a1' });
    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/approvals/a1');
  });
});

describe('decide_approval', () => {
  it('calls approve endpoint for approved decision', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: { id: 'a1', status: 'approved' } }));
    await handleApprovalTool('decide_approval', { approval_id: 'a1', decision: 'approved' });
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/v1/approvals/a1/approve', {});
  });

  it('calls reject endpoint for rejected decision', async () => {
    mockApiCall.mockResolvedValueOnce(ok({ data: {} }));
    await handleApprovalTool('decide_approval', { approval_id: 'a1', decision: 'rejected', note: 'not ready' });
    expect(mockApiCall).toHaveBeenCalledWith('POST', '/api/v1/approvals/a1/reject', { note: 'not ready' });
  });
});
