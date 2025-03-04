import { Buff }   from '@cmdcode/buff'
import { gcm }    from '@noble/ciphers/aes'
import { sha256 } from '@noble/hashes/sha256'
import { pbkdf2 } from '@noble/hashes/pbkdf2'

export function derive_secret (
  password  : string,
  rand_salt : string
) {
  const pass_bytes = Buff.str(password).digest
  const salt_bytes = Buff.hex(rand_salt, 32)
  const options    = { c: 32, dkLen: 32 }
  const secret     = pbkdf2(sha256, pass_bytes, salt_bytes, options)
  return new Buff(secret).hex
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