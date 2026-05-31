/**
 * ManageCallAI webhook signature verification
 *
 * Drop this into an n8n Code node placed immediately after the Webhook Trigger,
 * before any processing. Return false halts the workflow.
 *
 * Required n8n workflow credential / variable:
 *   MANAGECALL_WEBHOOK_SECRET  — the signing_secret returned when the webhook was created
 *
 * Headers sent by ManageCallAI on every delivery:
 *   X-ManageCall-Signature-256   sha256=<hmac-hex>
 *   X-ManageCall-Timestamp       Unix epoch seconds
 *   X-ManageCall-Event           e.g. ivr_flow.published
 *   X-ManageCall-Tenant          tenant UUID
 *   X-ManageCall-Delivery        delivery UUID (idempotency)
 *   X-ManageCall-Version         payload schema version (currently "1")
 */

// ── verifySignature ───────────────────────────────────────────────────────────
// Call this from the Code node. $input.first() is the Webhook Trigger item.
//
// Example Code node body:
//
//   const { verifySignature } = require('./webhook-verification.js');
//   // or inline the function directly in the Code node
//
//   const secret = $env.MANAGECALL_WEBHOOK_SECRET;
//   const result = verifySignature($input.first(), secret);
//   if (!result.valid) throw new Error(`Webhook rejected: ${result.reason}`);
//   return $input.all();

const crypto = require('crypto');

/**
 * @param {object} item        - n8n Webhook Trigger item ($input.first())
 * @param {string} secret      - signing_secret from the webhook registration response
 * @param {number} [tolerance] - max age of delivery in seconds (default 300)
 * @returns {{ valid: boolean, reason: string }}
 */
function verifySignature(item, secret, tolerance = 300) {
  const headers = item.headers ?? {};
  const rawBody = item.body ?? '';

  // 1. Timestamp check — reject stale deliveries
  const timestamp = parseInt(headers['x-managecall-timestamp'] ?? '0', 10);
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > tolerance) {
    return { valid: false, reason: `timestamp_expired (age=${Math.round(ageSeconds)}s)` };
  }

  // 2. Recompute expected signature
  //    ManageCallAI signs: HMAC-SHA256(secret, "${timestamp}.${rawBody}")
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  // 3. Timing-safe comparison
  const received = headers['x-managecall-signature-256'] ?? '';
  if (received.length === 0) {
    return { valid: false, reason: 'missing_signature' };
  }

  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(received),
    );
    return { valid: match, reason: match ? 'ok' : 'signature_mismatch' };
  } catch {
    // Buffer lengths differ → definite mismatch
    return { valid: false, reason: 'signature_mismatch' };
  }
}

// ── Inline Code node snippet (paste directly into n8n) ────────────────────────
/*

// ── Paste into Code node after Webhook Trigger ────────────────────────────────
const crypto = require('crypto');

function verifyManageCallWebhook(item, secret, toleranceSec = 300) {
  const h = item.headers ?? {};
  const timestamp = parseInt(h['x-managecall-timestamp'] ?? '0', 10);
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) {
    return { valid: false, reason: 'timestamp_expired' };
  }
  const body = typeof item.body === 'string' ? item.body : JSON.stringify(item.body ?? {});
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const received = h['x-managecall-signature-256'] ?? '';
  if (!received) return { valid: false, reason: 'missing_signature' };
  try {
    const match = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    return { valid: match, reason: match ? 'ok' : 'signature_mismatch' };
  } catch { return { valid: false, reason: 'signature_mismatch' }; }
}

const secret = $env.MANAGECALL_WEBHOOK_SECRET;
const result = verifyManageCallWebhook($input.first(), secret);
if (!result.valid) throw new Error(`Webhook signature invalid: ${result.reason}`);
return $input.all();

*/

module.exports = { verifySignature };
