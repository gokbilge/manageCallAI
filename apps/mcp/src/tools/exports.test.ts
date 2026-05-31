import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
}));

import { apiCall } from '../api-client.js';
import { handleExportTool } from './exports.js';

const mockApiCall = vi.mocked(apiCall);

beforeEach(() => vi.clearAllMocks());

describe('handleExportTool', () => {
  it('exports call events with encoded filters', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: true, status: 200, data: { data: [{ id: 'event-1' }] } });

    const result = await handleExportTool('export_call_events', {
      from: '2026-05-31T00:00:00Z',
      to: '2026-05-31T23:59:59Z',
      limit: 50,
    });

    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith(
      'GET',
      '/api/v1/export/call-events?from=2026-05-31T00%3A00%3A00Z&to=2026-05-31T23%3A59%3A59Z&limit=50',
    );
  });

  it('exports sessions without a query string when no filters are provided', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: true, status: 200, data: { data: [] } });

    const result = await handleExportTool('export_sessions', {});

    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/export/sessions');
  });

  it('returns isError on API failures', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: false, status: 429, data: { error: 'RESOURCE_EXHAUSTED' } });

    const result = await handleExportTool('export_call_events', {});

    expect(result.isError).toBe(true);
    expect(result.text).toContain('429');
  });

  it('rejects unknown export tool names', async () => {
    const result = await handleExportTool('export_shell', {});

    expect(result.isError).toBe(true);
    expect(mockApiCall).not.toHaveBeenCalled();
  });
});
