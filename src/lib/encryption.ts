import { Buff }   from '@cmdcode/buff'
import { gcm }    from '@noble/ciphers/aes'
import { sha256 } from '@noble/hashes/sha256'
import { pbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2'

export const PBKDF2_ITERATIONS_LEGACY = 32;
export const PBKDF2_ITERATIONS_V1 = 600_000;
export const PBKDF2_ITERATIONS_DEFAULT = PBKDF2_ITERATIONS_V1;
const PBKDF2_KEY_LENGTH = 32;
export const CURRENT_SHARE_VERSION = 1;

export function derive_secret (
  password  : string,
  rand_salt : string,
  iterations = PBKDF2_ITERATIONS_DEFAULT
) {
  const pass_bytes = Buff.str(password).digest
  const salt_bytes = Buff.hex(rand_salt, 32)
  const options    = { c: iterations, dkLen: PBKDF2_KEY_LENGTH }
  const secret     = pbkdf2(sha256, pass_bytes, salt_bytes, options)
  return new Buff(secret).hex
}

export async function derive_secret_async (
  password  : string,
  rand_salt : string,
  iterations = PBKDF2_ITERATIONS_DEFAULT
) {
  const saltBuff = Buff.hex(rand_salt, 32);
  const saltBytes = new Uint8Array(saltBuff as ArrayLike<number>);

  const passwordBuff = Buff.str(password);
  const passwordDigest = (passwordBuff as { digest?: Uint8Array }).digest;
  const passwordBytes = new Uint8Array(passwordDigest ?? passwordBuff);

  const shouldUseSubtle =
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined' &&
    typeof Uint8Array !== 'undefined';

  if (shouldUseSubtle) {
    try {
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        PBKDF2_KEY_LENGTH * 8
      );

      return new Buff(new Uint8Array(derivedBits)).hex;
    } catch (error) {
      console.warn('SubtleCrypto PBKDF2 failed, falling back to JS implementation', error);
      // Fall through to pbkdf2Async fallback below
    }
  }

  const options   = { c: iterations, dkLen: PBKDF2_KEY_LENGTH };
  const secret    = await pbkdf2Async(sha256, passwordBytes, saltBytes, options);
  return new Buff(secret).hex;
}

export function encrypt_payload (
  secret  : string,
  payload : string,
  iv?     : string
) {
  const cbytes = Buff.str(payload)
  const sbytes = Buff.hex(secret)
  const vector = (iv !== undefined)
    ? Buff.hex(iv, 24)
    : Buff.random(24)
  const encrypted = gcm(sbytes, vector).encrypt(cbytes)
  return Buff.join([ vector, encrypted ]).b64url
}

export function decrypt_payload (
  secret  : string,
  payload : string
) {
  const cbytes    = Buff.b64url(payload)
  const sbytes    = Buff.hex(secret)
  const vector    = cbytes.slice(0, 24)
  const encrypted = cbytes.slice(24)
  const decrypted = gcm(sbytes, vector).decrypt(encrypted)
  return new Buff(decrypted).str
}
