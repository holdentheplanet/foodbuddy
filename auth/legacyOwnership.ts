import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error('Invalid stored password hash.');
  }

  return new Uint8Array(
    hex.match(/.{2}/g)!.map(value => parseInt(value, 16))
  );
}

export async function verifyLegacyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$');

  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    return false;
  }

  const iterations = Number(parts[1]);

  if (!Number.isSafeInteger(iterations) ||
      iterations < 1 ||
      iterations > 1000000) {
    return false;
  }

  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);

  const actual = await pbkdf2Async(sha256, password, salt, {
    c: iterations,
    dkLen: expected.length,
  });

  if (actual.length !== expected.length) return false;

  let difference = 0;

  for (let i = 0; i < actual.length; i++) {
    difference |= actual[i] ^ expected[i];
  }

  return difference === 0;
}

