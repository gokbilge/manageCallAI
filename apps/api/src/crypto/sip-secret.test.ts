import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './sip-secret.js';

const KEY = Buffer.alloc(32, 0x42);
const KEY_ID = 'test-v1';

describe('sip-secret', () => {
  it('round-trips a plaintext password', () => {
    const { ciphertext, keyId } = encrypt('MyS3cr3t!', KEY, KEY_ID);
    expect(keyId).toBe(KEY_ID);
    expect(ciphertext).not.toContain('MyS3cr3t!');
    expect(decrypt(ciphertext, KEY_ID, KEY)).toBe('MyS3cr3t!');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const a = encrypt('secret', KEY, KEY_ID).ciphertext;
    const b = encrypt('secret', KEY, KEY_ID).ciphertext;
    expect(a).not.toBe(b);
  });

  it('ciphertext has three dot-separated parts', () => {
    const { ciphertext } = encrypt('pass', KEY, KEY_ID);
    expect(ciphertext.split('.')).toHaveLength(3);
  });

  it('rejects a wrong key (AES-GCM auth tag mismatch)', () => {
    const { ciphertext } = encrypt('secret', KEY, KEY_ID);
    const wrongKey = Buffer.alloc(32, 0x01);
    expect(() => decrypt(ciphertext, KEY_ID, wrongKey)).toThrow();
  });

  it('rejects a tampered ciphertext', () => {
    const { ciphertext } = encrypt('secret', KEY, KEY_ID);
    const parts = ciphertext.split('.');
    const tampered = `${parts[0]}.${parts[1]}.AAAA${parts[2]!.slice(4)}`;
    expect(() => decrypt(tampered, KEY_ID, KEY)).toThrow();
  });

  it('rejects malformed ciphertext', () => {
    expect(() => decrypt('notvalid', KEY_ID, KEY)).toThrow('Invalid ciphertext format');
  });
});
