import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Skills API integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';

    const { buildApp } = await import('../../app.js');
    ({ db } = await import('../../db/client.js'));
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE TABLE tenants CASCADE');
  });

  async function register(suffix: string): Promise<{ token: string; userId: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${suffix}`,
        tenant_slug: `tenant-${suffix}`,
        email: `user-${suffix}@example.com`,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    const { token } = res.json<{ token: string }>();
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { sub: string };
    return { token, userId: payload.sub };
  }

  it('GET /skills -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/skills' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /skills -> creates skill', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Spanish', description: 'Native or fluent Spanish speaker' },
    });
    expect(create.statusCode).toBe(201);
    const skill = create.json<{ data: { id: string; name: string; status: string } }>().data;
    expect(skill.name).toBe('Spanish');
    expect(skill.status).toBe('active');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/skills',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('assigns skill to agent and evaluates routing', async () => {
    const { token, userId } = await register(randomUUID().slice(0, 8));

    // Create skill
    const skillRes = await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'English' },
    });
    const skillId = skillRes.json<{ data: { id: string } }>().data.id;

    // Create queue
    const queueRes = await app.inject({
      method: 'POST',
      url: '/api/v1/queues',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Support Queue' },
    });
    const queueId = queueRes.json<{ data: { id: string } }>().data.id;

    // Create agent profile
    const agentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-profiles',
      headers: { authorization: `Bearer ${token}` },
      payload: { user_id: userId, display_name: 'Test Agent' },
    });
    const agentId = agentRes.json<{ data: { id: string } }>().data.id;

    // Assign skill to agent with proficiency 3
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/v1/agent-profiles/${agentId}/skills`,
      headers: { authorization: `Bearer ${token}` },
      payload: { skill_id: skillId, proficiency: 3 },
    });
    expect(assignRes.statusCode).toBe(201);

    // Add skill requirement to queue with min_proficiency 2
    const reqRes = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/skill-requirements`,
      headers: { authorization: `Bearer ${token}` },
      payload: { skill_id: skillId, min_proficiency: 2 },
    });
    expect(reqRes.statusCode).toBe(201);

    // Evaluate routing: agent proficiency 3 >= required 2 → eligible
    const evalRes = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/routing-evaluation/${agentId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(evalRes.statusCode).toBe(201);
    expect(evalRes.json<{ data: { eligible: boolean } }>().data.eligible).toBe(true);

    // Routing log
    const logRes = await app.inject({
      method: 'GET',
      url: `/api/v1/queues/${queueId}/routing-log`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logRes.statusCode).toBe(200);
    expect(logRes.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('tenant isolation: cannot see another tenant skills', async () => {
    const { token: t1 } = await register(randomUUID().slice(0, 8));
    const { token: t2 } = await register(randomUUID().slice(0, 8));

    await app.inject({
      method: 'POST',
      url: '/api/v1/skills',
      headers: { authorization: `Bearer ${t1}` },
      payload: { name: 'French' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/skills',
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(0);
  });
});
