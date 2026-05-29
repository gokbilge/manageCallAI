import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRecordingTool } from './recordings.js';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
}));

import { apiCall } from '../api-client.js';

describe('handleRecordingTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list_recordings calls /api/v1/recordings', async () => {
    vi.mocked(apiCall).mockResolvedValue({ ok: true, status: 200, data: { data: [] } });
    const result = await handleRecordingTool('list_recordings', {});
    expect(apiCall).toHaveBeenCalledWith('GET', '/api/v1/recordings');
    expect(result.isError).toBeFalsy();
  });

  it('list_recordings includes call_id query param', async () => {
    vi.mocked(apiCall).mockResolvedValue({ ok: true, status: 200, data: { data: [] } });
    await handleRecordingTool('list_recordings', { call_id: 'call-abc' });
    expect(apiCall).toHaveBeenCalledWith('GET', '/api/v1/recordings?call_id=call-abc');
  });

  it('get_recording calls correct endpoint', async () => {
    vi.mocked(apiCall).mockResolvedValue({ ok: true, status: 200, data: { data: { id: 'rec-1' } } });
    const result = await handleRecordingTool('get_recording', { recording_id: 'rec-1' });
    expect(apiCall).toHaveBeenCalledWith('GET', '/api/v1/recordings/rec-1');
    expect(result.isError).toBeFalsy();
  });

  it('list_recording_analyses calls correct endpoint', async () => {
    vi.mocked(apiCall).mockResolvedValue({ ok: true, status: 200, data: { data: [] } });
    await handleRecordingTool('list_recording_analyses', { recording_id: 'rec-1' });
    expect(apiCall).toHaveBeenCalledWith('GET', '/api/v1/recordings/rec-1/analysis-requests');
  });

  it('get_recording_analysis calls correct endpoint', async () => {
    vi.mocked(apiCall).mockResolvedValue({ ok: true, status: 200, data: { data: {} } });
    await handleRecordingTool('get_recording_analysis', {
      recording_id: 'rec-1',
      analysis_request_id: 'ar-1',
    });
    expect(apiCall).toHaveBeenCalledWith('GET', '/api/v1/recordings/rec-1/analysis-requests/ar-1');
  });

  it('returns isError on non-ok response', async () => {
    vi.mocked(apiCall).mockResolvedValue({ ok: false, status: 404, data: { error: 'not found' } });
    const result = await handleRecordingTool('get_recording', { recording_id: 'missing' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('404');
  });

  it('returns error for unknown tool name', async () => {
    const result = await handleRecordingTool('unknown_tool', {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Unknown recording tool');
  });
});
