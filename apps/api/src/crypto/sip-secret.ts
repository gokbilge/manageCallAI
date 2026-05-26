import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

// Lazy-loaded so the module can be imported in tests without the env vars being set.
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (!_key) {
    _key = Buffer.from(config.sipSecretMasterKey, 'hex');
    if (_key.length !== 32) {
      throw new Error('SIP_SECRET_MASTER_KEY must be 64 hex chars (32 bytes)');
    }
  }
  return _key;
}

/**
 * Encrypt a plaintext SIP password with AES-256-GCM.
 * Wire format stored in DB: base64(iv).base64(authTag).base64(ciphertext)
 */
export function encrypt(
  plaintext: string,
  key: Buffer,
  keyId: string,
): { ciphertext: string; keyId: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  return { ciphertext, keyId };
}

/**
 * Decrypt a ciphertext produced by `encrypt`. Throws on tampered data.
 */
export function decrypt(ciphertext: string, keyId: string, key: Buffer): string {
  const parts = ciphertext.split('.');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivB64, tagB64, encB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/** Encrypt a SIP password using the key configured in the environment. */
export function encryptSipPassword(plaintext: string): { ciphertext: string; keyId: string } {
  return encrypt(plaintext, getKey(), config.sipSecretKeyId);
}

/** Decrypt a SIP password using the key configured in the environment. */
export function decryptSipPassword(ciphertext: string, keyId: string): string {
  if (keyId !== config.sipSecretKeyId) {
    // Key rotation: in future, look up key by id from a keystore.
    throw new Error(`Unknown key id '${keyId}' — key rotation not yet supported`);
  }
  return decrypt(ciphertext, keyId, getKey());
}
