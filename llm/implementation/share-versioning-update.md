# Implementing Versioned Share Files in Igloo Desktop

This note captures the code changes that introduced versioned share files and strengthened the password-based key derivation while maintaining backward compatibility.

## Goals

1. Tag newly-saved shares with an explicit format version so future migrations are possible.
2. Raise the PBKDF2 iteration count used for encryption to 100 000 without breaking previously saved files (which used 32 iterations).
3. Ensure the renderer, Electron main process, and tests understand the new schema.

## Key Changes

### Encryption Constants (`src/lib/encryption.ts`)
- Added exported constants:
  - `PBKDF2_ITERATIONS_LEGACY = 32`
  - `PBKDF2_ITERATIONS_V1 = 100_000`
  - `PBKDF2_ITERATIONS_DEFAULT` (alias to the v1 value)
  - `CURRENT_SHARE_VERSION = 1`
- `derive_secret` now accepts an optional `iterations` argument (defaulting to `PBKDF2_ITERATIONS_DEFAULT`).

### Share Type Updates
- `IglooShare` (renderer) and the main-process mirror now include an optional `version` field and accept optional `savedAt/metadata` properties.

### Saving Shares (renderer)
- `Keyset.tsx` sets `version: CURRENT_SHARE_VERSION` whenever a share is persisted.

### Loading Shares (renderer)
- `LoadShare.tsx` inspects the share version:
  - `version >= CURRENT_SHARE_VERSION` ⇒ use `PBKDF2_ITERATIONS_DEFAULT` (100 000).
  - Missing or lower version ⇒ use `PBKDF2_ITERATIONS_LEGACY` (32).

### Documentation
- Updated `llm/context/keyset-creation-flow.md` to describe the new versioned KDF behavior.
- Authored a separate specification (`llm/spec/share-file-version1.md`) so other applications can interoperate with version 1 files.

### Tests
- `src/__tests__/encryption.test.ts` now imports the iteration constants and asserts both default and override code paths.
- Workflow and integration suites (`clientShareManager` and share lifecycle) continue to pass without fixture changes because mocks rely on the exported helper.

## Backward Compatibility

- Files created before this change lacked a `version` field and used 32 PBKDF2 iterations. The loader falls back to the legacy constant in that case.
- New files always include `"version": 1`, signaling the stronger KDF configuration. Consumers parsing shares should follow the lookup table above to decide which iteration count to apply.

## Future Work

- When introducing subsequent versions, bump `CURRENT_SHARE_VERSION`, document the new schema, and extend the conditional in `LoadShare.tsx` to handle additional cases.
- Consider migrating legacy files in place or prompting users to re-save shares with the stronger configuration.
