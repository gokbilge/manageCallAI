import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Recording summary review API integration', () => {
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

  async function register(suffix: string): Promise<string> {
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
    expect(res.statusCode).toBe(201);
    return res.json<{ token: string }>().token;
  }

  function decodeJwt(token: string): { tenant_id: string } {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as { tenant_id: string };
  }

  function scopedToken(baseToken: string, role: 'tenant_operator' | 'end_user'): string {
    const { tenant_id } = decodeJwt(baseToken);
    return app.jwt.sign({
      sub: randomUUID(),
      tenant_id,
      email: `${role}-${randomUUID().slice(0, 8)}@example.com`,
      role,
    });
  }

  async function seedRecordingWithAnalysis(tenantId: string, options?: { withAnalysis?: boolean }) {
    const recording = await db.query<{ id: string }>(
      `INSERT INTO call_recordings (tenant_id, call_id, storage_path, duration_secs, size_bytes)
       VALUES ($1, $2, $3, 45, 4096)
       RETURNING id`,
      [tenantId, 'call-1', 'tenant-1/call-1.wav'],
    );
    const recordingId = recording.rows[0]!.id;

    if (options?.withAnalysis !== false) {
      await db.query(
        `INSERT INTO recording_analysis_requests
           (tenant_id, recording_id, requested_outputs, status, language, transcript_text, summary_text, provider_metadata, metadata, completed_at)
         VALUES ($1, $2, ARRAY['transcript','summary']::text[], 'completed', 'en', $3, $4, '{}'::jsonb, '{}'::jsonb, NOW())`,
        [
          tenantId,
          recordingId,
          'Caller asked for a callback about an outage.',
          'Caller reported an outage and requested a callback.',
        ],
      );
    }

    return recordingId;
  }

  it('returns summary and transcript for compliance-capable admins', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const { tenant_id } = decodeJwt(token);
    const recordingId = await seedRecordingWithAnalysis(tenant_id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}/summary-review`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { status: string; summary_text: string; transcript_text: string; transcript_access: string } }>().data)
      .toMatchObject({
        status: 'completed',
        transcript_access: 'granted',
      });
  });

  it('restricts transcript text for operators without compliance capability', async () => {
    const adminToken = await register(randomUUID().slice(0, 8));
    const { tenant_id } = decodeJwt(adminToken);
    const recordingId = await seedRecordingWithAnalysis(tenant_id);
    const operatorToken = scopedToken(adminToken, 'tenant_operator');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}/summary-review`,
      headers: { authorization: `Bearer ${operatorToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { summary_text: string; transcript_text: string | null; transcript_access: string } }>().data)
      .toMatchObject({
        transcript_text: null,
        transcript_access: 'restricted',
      });
  });

  it('returns missing_analysis when a recording has no analysis request yet', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const { tenant_id } = decodeJwt(token);
    const recordingId = await seedRecordingWithAnalysis(tenant_id, { withAnalysis: false });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}/summary-review`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { status: string; reason: string } }>().data).toMatchObject({
      status: 'missing_analysis',
      reason: 'no_analysis_request',
    });
  });

  it('denies summary review to end-user tokens', async () => {
    const adminToken = await register(randomUUID().slice(0, 8));
    const { tenant_id } = decodeJwt(adminToken);
    const recordingId = await seedRecordingWithAnalysis(tenant_id);
    const endUserToken = scopedToken(adminToken, 'end_user');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}/summary-review`,
      headers: { authorization: `Bearer ${endUserToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns unavailable for voicemail messages without a linked recording analysis path', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const { tenant_id } = decodeJwt(token);
    const box = await db.query<{ id: string }>(
      `INSERT INTO voicemail_boxes (tenant_id, name, mailbox_number)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tenant_id, 'Support Mailbox', '200'],
    );
    const boxId = box.rows[0]!.id;
    const message = await db.query<{ id: string }>(
      `INSERT INTO voicemail_messages (tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes)
       VALUES ($1, $2, $3, $4, 18, 1024)
       RETURNING id`,
      [tenant_id, boxId, 'call-vm-1', 'vm/call-vm-1.wav'],
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/voicemail-boxes/messages/${message.rows[0]!.id}/summary-review`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { status: string; reason: string } }>().data).toMatchObject({
      status: 'unavailable',
      reason: 'no_linked_recording',
    });
  });
});
