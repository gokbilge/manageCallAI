import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
}));

import { apiCall } from '../api-client.js';
import { handleScheduleTool } from './schedules.js';

const mockApiCall = vi.mocked(apiCall);

beforeEach(() => vi.clearAllMocks());

describe('handleScheduleTool', () => {
  it('lists tenant schedules', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: true, status: 200, data: { data: [{ id: 'schedule-1' }] } });

    const result = await handleScheduleTool('list_schedules', {});

    expect(result.isError).toBeFalsy();
    expect(result.text).toContain('schedule-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/schedules');
  });

  it('maps permission errors to tool errors', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: false, status: 403, data: { error: 'PERMISSION_DENIED' } });

    const result = await handleScheduleTool('list_schedules', {});

    expect(result.isError).toBe(true);
    expect(result.text).toContain('PERMISSION_DENIED');
  });

  it('rejects unknown schedule tool names', async () => {
    const result = await handleScheduleTool('delete_schedule', {});

    expect(result.isError).toBe(true);
    expect(mockApiCall).not.toHaveBeenCalled();
  });
});
