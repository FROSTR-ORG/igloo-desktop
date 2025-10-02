# Share File Format — Version 1

This reference describes how compatible applications should persist Igloo signer shares starting with **version 1**.

## JSON Schema

Each share is stored as JSON. The following fields are recognised:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | ✓ | Unique identifier, e.g. `my-keyset_share_1`. |
| `name` | string | ✓ | Human-readable label such as `My Keyset share 1`. |
| `share` | string | ✓ | Base64url-encoded AES-GCM ciphertext of the `bfshare…` payload. |
| `salt` | string | ✓ | 16-byte random salt encoded as lowercase hex. |
| `groupCredential` | string | ✓ | Correlated `bfgroup…` credential. |
| `version` | number | ✓ | File format version. `1` corresponds to the parameters below. |
| `savedAt` | string | — | ISO-8601 timestamp of persistence. |
| `metadata` | object | — | Optional contextual details (binder serial, etc.). |
| `policy` | object | — | Directional policy defaults and overrides for peers. See below. |

> Producers **MUST** include `"version": 1` when writing new share files. Consumers **MUST** treat files without a `version` field as legacy (pre-v1) and fall back to the legacy behaviour (PBKDF2 with 32 iterations).

Additional properties MAY be present for forward compatibility.

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
  },
  "policy": {
    "defaults": {
      "allowSend": true,
      "allowReceive": true
    },
    "peers": {
      "npub1example...": {
        "allowSend": true,
        "allowReceive": false,
        "updatedAt": "2025-10-02T08:15:30.000Z"
      }
    },
    "updatedAt": "2025-10-02T08:15:30.000Z"
  }
}
```

### Policy Field

- `defaults` records the baseline behaviour (inbound/outbound) and MUST default to allowing both directions.
- `peers` is an optional map keyed by normalized (lowercase) pubkeys; entries only appear when the signer overrides the defaults for that peer.
- `updatedAt` is an ISO-8601 timestamp refreshed whenever the signer persists policy updates.

> Consumers MUST treat missing `policy` objects (or files with `version < 1`) as "allow both directions" for every peer and SHOULD only create the `policy` field when a share is upgraded to version 1 or later.

## Key Derivation

- Algorithm: PBKDF2 with SHA-256
- Iterations: **600 000**
- Derived key length: 32 bytes
- Salt: 16 random bytes stored in `salt`

```
key = PBKDF2-SHA256(passwordBytes, saltBytes, iterations = 600000, dkLen = 32)
```

## Encryption

- Cipher: AES-256-GCM
- Key: Derived key above
- IV (nonce): 24 random bytes
- Output: `share` is the base64url encoding of `IV || ciphertext`

Consumers should validate that decrypted plaintext begins with `bfshare` before using it.
