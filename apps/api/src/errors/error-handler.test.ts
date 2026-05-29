import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerErrorHandler } from './error-handler.js';
import {
  sendAlreadyExists,
  sendConflict,
  sendFailedPrecondition,
  sendUnauthenticated,
} from './error-reply.js';

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

  it('returns CONFLICT for generic 409 errors thrown through the error handler', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw Object.assign(new Error('dup'), { statusCode: 409 });
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('CONFLICT');
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

  it('emits x-request-id header on every response', async () => {
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

  // ── request_id correctness ────────────────────────────────────────────────────

  it('error body has non-empty request_id', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw new Error('boom');
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = res.json();
    expect(body.request_id).toBeTruthy();
  });

  it('body.request_id matches x-request-id header', async () => {
    const app = buildTestApp();
    app.get('/test', async () => {
      throw new Error('boom');
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    const body = res.json();
    expect(body.request_id).toBe(res.headers['x-request-id']);
  });

  it('sendUnauthenticated via helper produces non-empty request_id', async () => {
    const app = buildTestApp();
    app.get('/test', async (_req, reply) => {
      return sendUnauthenticated(reply, 'No token');
    });

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('UNAUTHENTICATED');
    expect(body.request_id).toBeTruthy();
    expect(body.request_id).toBe(res.headers['x-request-id']);
  });

  // ── new error codes ───────────────────────────────────────────────────────────

  it('sendAlreadyExists returns ALREADY_EXISTS with non-empty request_id', async () => {
    const app = buildTestApp();
    app.post('/test', async (_req, reply) => {
      return sendAlreadyExists(reply, 'Email already exists');
    });

    const res = await app.inject({ method: 'POST', url: '/test' });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe('ALREADY_EXISTS');
    expect(body.message).toBe('Email already exists');
    expect(body.request_id).toBeTruthy();
    expect(body.request_id).toBe(res.headers['x-request-id']);
  });

  it('sendFailedPrecondition returns FAILED_PRECONDITION with non-empty request_id', async () => {
    const app = buildTestApp();
    app.post('/test', async (_req, reply) => {
      return sendFailedPrecondition(reply, 'Session is not running: completed');
    });

    const res = await app.inject({ method: 'POST', url: '/test' });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe('FAILED_PRECONDITION');
    expect(body.message).toBe('Session is not running: completed');
    expect(body.request_id).toBeTruthy();
    expect(body.request_id).toBe(res.headers['x-request-id']);
  });

  it('sendConflict returns CONFLICT (not ALREADY_EXISTS)', async () => {
    const app = buildTestApp();
    app.post('/test', async (_req, reply) => {
      return sendConflict(reply, 'Generic conflict');
    });

    const res = await app.inject({ method: 'POST', url: '/test' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('CONFLICT');
  });
});

