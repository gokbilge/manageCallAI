import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerErrorHandler } from './error-handler.js';

function buildTestApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  return app;
}

describe('registerErrorHandler', () => {
  it('returns INVALID_ARGUMENT for schema validation failure', async () => {
    const app = buildTestApp();
    app.get(
      '/test',
      {
        schema: {
          querystring: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
        },
      },
      async () => ({ ok: true }),
    );

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('INVALID_ARGUMENT');
    expect(body).toHaveProperty('request_id');
    expect(body).toHaveProperty('message');
  });

  it('returns UNAUTHENTICATED for 401 errors', async () => {
    const app = buildTestApp();
    app.get('/test', async (_req, reply) => {
      reply.code(401);
      throw Object.assign(new Error('no'), { statusCode: 401 });
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('UNAUTHENTICATED');
  });

  it('returns PERMISSION_DENIED for 403 errors', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw Object.assign(new Error('no'), { statusCode: 403 });
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('PERMISSION_DENIED');
  });

  it('returns NOT_FOUND for 404 errors', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw Object.assign(new Error('missing'), { statusCode: 404 });
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });

  it('returns ALREADY_EXISTS for 409 errors', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw Object.assign(new Error('dup'), { statusCode: 409 });
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('ALREADY_EXISTS');
  });

  it('returns INTERNAL for unhandled errors', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw new Error('oops');
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('INTERNAL');
    expect(body.message).toBe('Internal server error');
  });

  it('emits X-Request-ID header on every response', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw new Error('oops');
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns UNAVAILABLE for 503 errors', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw Object.assign(new Error('down'), { statusCode: 503 });
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('UNAVAILABLE');
  });

  it('does not expose stack traces in response body', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw new Error('secret internal detail');
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = res.json<{ message: string }>();
    expect(body.message).not.toContain('secret internal detail');
    expect(body.message).toBe('Internal server error');
  });
});
