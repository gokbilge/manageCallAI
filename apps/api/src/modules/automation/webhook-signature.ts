import { timingSafeEqual } from 'node:crypto';
import { AutomationRepository } from './automation.repository.js';

export type WebhookVerificationInput = {
  secret: string;
  body: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  nowSeconds?: number;
  replayWindowSeconds?: number;
};

export type WebhookVerificationResult =
  | { ok: true }
  | { ok: false; reason: 'missing_header' | 'invalid_timestamp' | 'replay_window' | 'invalid_signature' };

export function verifyWebhookSignature(input: WebhookVerificationInput): WebhookVerificationResult {
  const replayWindowSeconds = input.replayWindowSeconds ?? 300;
  if (!input.signatureHeader || !input.timestampHeader) {
    return { ok: false, reason: 'missing_header' };
  }

  const timestamp = Number.parseInt(input.timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > replayWindowSeconds) {
    return { ok: false, reason: 'replay_window' };
  }

  const signature = input.signatureHeader.startsWith('sha256=')
    ? input.signatureHeader.slice('sha256='.length)
    : input.signatureHeader;
  const expected = AutomationRepository.signPayload(input.secret, `${timestamp}.${input.body}`);

  return timingSafeHexEqual(signature, expected) ? { ok: true } : { ok: false, reason: 'invalid_signature' };
}

function timingSafeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
