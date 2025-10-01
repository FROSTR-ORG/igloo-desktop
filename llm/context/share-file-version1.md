# Igloo Share File Specification — Version 1

This document defines the JSON file format for encrypted signer shares beginning with **version 1**. Client applications that interoperate with Igloo Desktop must follow this structure when persisting or consuming share files.

## File Structure

Each share is stored as a standalone UTF-8 JSON file whose name matches `<share.id>.json`. The payload has the following fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | ✓ | Unique identifier (e.g. `my-keyset_share_1`). |
| `name` | string | ✓ | Human-readable label (e.g. `My Keyset share 1`). |
| `share` | string | ✓ | Base64url-encoded AES-GCM ciphertext of the `bfshare…` string. |
| `salt` | string | ✓ | 16-byte random salt encoded as lowercase hex. |
| `groupCredential` | string | ✓ | The associated `bfgroup…` credential. |
| `version` | number | ✓ | File format version. `1` indicates the schema described here. |
| `savedAt` | string | — | ISO-8601 timestamp of persistence. |
| `metadata` | object | — | Optional additional context (e.g. binder serial numbers). |

Additional fields MAY be included for forward compatibility but MUST NOT alter the semantics above.

### Example

```json
{
  "id": "my-keyset_share_1",
  "name": "My Keyset share 1",
  "share": "pG6y9u9…", 
  "salt": "4f1a8c77d3f2a6b4dbeaa8f1e0c2b7d9",
  "groupCredential": "bfgroup1…",
  "version": 1,
  "savedAt": "2025-10-01T12:34:56.000Z",
  "metadata": {
    "binder_sn": "abc123"
  }
}
```

## Key Derivation

- **Algorithm:** PBKDF2 with SHA-256
- **Iterations:** `100000`
- **Derived key length (`dkLen`):** `32` bytes
- **Salt:** 16 random bytes (`salt` field)

Derive the key as:

```
keyBytes = PBKDF2-SHA256(passwordBytes, saltBytes, iterations=100000, dkLen=32)
```

Password bytes are the UTF-8 encoding of the user-entered password. Salt bytes are the hex-decoded value of the `salt` field.

## Encryption

- **Cipher:** AES-256-GCM
- **Key:** Derived key bytes described above
- **IV (nonce):** 24 random bytes
- **Output:** IV prepended to ciphertext, then encoded as base64url -> stored in the `share` field

Applications MUST validate that decrypted plaintext begins with the `bfshare` prefix before treating it as valid.

## Compatibility Notes

- Files missing a `version` field are considered legacy (pre-v1) and used PBKDF2 with 32 iterations. Consumers SHOULD fall back to that value when loading older files.
- New producers MUST include `"version": 1` and the iteration count defined above to avoid weakening security going forward.
