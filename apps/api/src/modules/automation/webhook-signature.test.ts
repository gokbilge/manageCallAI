import { describe, expect, it } from 'vitest';
import { AutomationRepository } from './automation.repository.js';
import { verifyWebhookSignature } from './webhook-signature.js';

describe('verifyWebhookSignature', () => {
  const secret = 'webhook-secret';
  const body = JSON.stringify({ event: 'call.completed', data: { call_id: 'call-1' } });
  const timestamp = 1_800_000_000;
  const signature = `sha256=${AutomationRepository.signPayload(secret, `${timestamp}.${body}`)}`;

  it('accepts a valid signed payload inside the replay window', () => {
    expect(
      verifyWebhookSignature({
        secret,
        body,
        signatureHeader: signature,
        timestampHeader: String(timestamp),
        nowSeconds: timestamp + 60,
      }),
    ).toEqual({ ok: true });
  });

  it('rejects missing signature headers', () => {
    expect(
      verifyWebhookSignature({
        secret,
        body,
        signatureHeader: undefined,
        timestampHeader: String(timestamp),
      }),
    ).toEqual({ ok: false, reason: 'missing_header' });
  });

  it('rejects payloads outside the replay window', () => {
    expect(
      verifyWebhookSignature({
        secret,
        body,
        signatureHeader: signature,
        timestampHeader: String(timestamp),
        nowSeconds: timestamp + 301,
        replayWindowSeconds: 300,
      }),
    ).toEqual({ ok: false, reason: 'replay_window' });
  });

  it('rejects signatures for a different body', () => {
    expect(
      verifyWebhookSignature({
        secret,
        body: JSON.stringify({ event: 'call.completed', data: { call_id: 'changed' } }),
        signatureHeader: signature,
        timestampHeader: String(timestamp),
        nowSeconds: timestamp,
      }),
    ).toEqual({ ok: false, reason: 'invalid_signature' });
  });
});
