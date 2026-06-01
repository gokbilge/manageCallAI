import { describe, expect, it, vi, afterEach } from 'vitest';
import { apiRequest } from './client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

afterEach(() => vi.clearAllMocks());

describe('apiRequest', () => {
  it('returns parsed JSON for a successful response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [{ id: '1' }] }));
    const result = await apiRequest<{ data: { id: string }[] }>('/extensions');
    expect(result.data[0]!.id).toBe('1');
  });

  it('sets Authorization header from accessToken', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await apiRequest('/test', { accessToken: 'my-token' });
    const headers: Headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers.get('Authorization')).toBe('Bearer my-token');
  });

  it('sets X-Request-Id header from requestId', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await apiRequest('/test', { requestId: 'req-123' });
    const headers: Headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers.get('X-Request-Id')).toBe('req-123');
  });

  it('sets Content-Type to application/json when body is present', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 201));
    await apiRequest('/test', { method: 'POST', body: '{"a":1}' });
    const headers: Headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not override Content-Type when already set', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 201));
    const existingHeaders = new Headers({ 'Content-Type': 'text/plain' });
    await apiRequest('/test', { method: 'POST', body: 'raw', headers: existingHeaders });
    const headers: Headers = mockFetch.mock.calls[0]![1].headers;
    expect(headers.get('Content-Type')).toBe('text/plain');
  });

  it('throws ApiError on 4xx with error field in body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'NOT_FOUND' }, 404));
    await expect(apiRequest('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'NOT_FOUND',
      status: 404,
    });
  });

  it('throws ApiError on 4xx with fallback message when no error field', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ detail: 'gone' }, 410));
    await expect(apiRequest('/gone')).rejects.toMatchObject({
      name: 'ApiError',
      status: 410,
      message: 'API request failed: 410',
    });
  });

  it('throws ApiError on non-JSON error body without crashing', async () => {
    const badResponse = {
      ok: false, status: 503,
      json: () => Promise.reject(new SyntaxError('bad json')),
    } as Response;
    mockFetch.mockResolvedValue(badResponse);
    await expect(apiRequest('/service-unavailable')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('dispatches managecallai:unauthorized event on 401', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'UNAUTHENTICATED' }, 401));
    const events: Event[] = [];
    window.addEventListener('managecallai:unauthorized', (e) => events.push(e));
    await expect(apiRequest('/secured')).rejects.toThrow();
    expect(events).toHaveLength(1);
  });
});
