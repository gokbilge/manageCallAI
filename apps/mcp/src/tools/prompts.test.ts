import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api-client.js', () => ({
  apiCall: vi.fn(),
}));

import { apiCall } from '../api-client.js';
import { handlePromptTool } from './prompts.js';

const mockApiCall = vi.mocked(apiCall);

beforeEach(() => vi.clearAllMocks());

describe('handlePromptTool', () => {
  it('lists tenant prompt assets', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: true, status: 200, data: { data: [{ id: 'prompt-1' }] } });

    const result = await handlePromptTool('list_prompts', {});

    expect(result.isError).toBeFalsy();
    expect(result.text).toContain('prompt-1');
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/prompts');
  });

  it('gets one prompt asset by id', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: true, status: 200, data: { data: { id: 'prompt-1' } } });

    const result = await handlePromptTool('get_prompt', { prompt_id: 'prompt-1' });

    expect(result.isError).toBeFalsy();
    expect(mockApiCall).toHaveBeenCalledWith('GET', '/api/v1/prompts/prompt-1');
  });

  it('maps API failures to MCP tool errors', async () => {
    mockApiCall.mockResolvedValueOnce({ ok: false, status: 403, data: { error: 'PERMISSION_DENIED' } });

    const result = await handlePromptTool('list_prompts', {});

    expect(result.isError).toBe(true);
    expect(result.text).toContain('API error 403');
  });

  it('rejects unknown prompt tool names', async () => {
    const result = await handlePromptTool('create_prompt', {});

    expect(result.isError).toBe(true);
    expect(result.text).toContain('Unknown prompt tool');
    expect(mockApiCall).not.toHaveBeenCalled();
  });
});
