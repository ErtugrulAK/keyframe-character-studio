import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256Bytes, toHex } from '../utils/persistence/sha256';

const plain = (text: string) => toHex(sha256Bytes(new TextEncoder().encode(text)));

describe('plain-JavaScript SHA-256 (LAN pages without crypto.subtle)', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(plain('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(plain('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(plain('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('matches Web Crypto on every padding boundary and on non-ASCII text', async () => {
    const texts = [...Array.from({ length: 140 }, (_, n) => 'x'.repeat(n)), 'Işık · ğüşöç · 日本語 · 🎬', `data:image/png;base64,${'QUJD'.repeat(5000)}`];
    for (const text of texts) {
      const bytes = new TextEncoder().encode(text);
      const web = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
      expect(toHex(sha256Bytes(bytes)), `length ${text.length}`).toBe(web);
      expect(web).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
});
