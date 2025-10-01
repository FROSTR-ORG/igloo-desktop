# Keyset Creation and Saving Flow

## Overview
Igloo Desktop builds a keyset in-memory, lets the user fan out each share, and only persists encrypted shares that the user explicitly saves. This flow involves the React `Create` and `Keyset` screens, the renderer-side `clientShareManager`, and the Electron main-process `ShareManager` that writes JSON files under the OS application data directory.

## Keyset Input Stage (`src/components/Create.tsx`)
1. On mount, the component loads existing shares via `clientShareManager.getShares()` to prevent duplicate keyset names. Saved share names follow the pattern `<keyset name> share <index>`; `handleNameChange` strips the `" share N"` suffix before checking for collisions.
2. The user can paste an `nsec` or click **Generate**, which calls `generateNostrKeyPair()` and stores the returned `nsec`.
3. `handleNsecChange` validates that the secret decodes to a 32-byte hex key using `nsecToHex`.
4. Threshold and total share counts default to `2-of-3` and must satisfy `2 ≤ threshold ≤ totalKeys`.
5. When the form is valid, **Create keyset** invokes `generateKeysetWithSecret(threshold, totalKeys, hexKey)`. The call returns `{ groupCredential, shareCredentials }`, which are forwarded to the root `App` in a `KeysetData` payload alongside the chosen name.

## Presenting the Keyset (`src/components/App.tsx` & `Keyset.tsx`)
- `App` flips `showingNewKeyset` to render the `Keyset` component. At this point the full keyset only lives in React state.
- `Keyset` decodes the credentials with `decodeGroup` and `decodeShare` so users can inspect metadata. It also calls `startListeningForAllEchoes(...)` to detect when shares are scanned into another device and flags those entries as saved.
- Each share card offers **Copy**, QR generation (via `QRCodeSVG`), and **Save** actions. Until shares are saved, the plaintext `bfshare...` values remain visible.

## Persisting Shares (`SaveShare.tsx`, `clientShareManager`, `ShareManager`)
1. Choosing **Save** opens the `SaveShare` modal. The user must enter and confirm a password of at least eight characters.
2. `SaveShare` generates a 16-byte random salt, then derives a 32-byte secret with `derive_secret(password, salt)` which wraps PBKDF2-SHA256 (`c: 32`, `dkLen: 32`).
3. The share is encrypted with AES-GCM (`encrypt_payload`) and the salt and encrypted blob are returned to `Keyset`.
4. `Keyset` builds an `IglooShare` object:
   ```json
   {
     "id": "<keyset>_share_<idx>",
     "name": "<keyset> share <idx>",
     "share": "<encrypted payload>",
     "salt": "<hex salt>",
     "groupCredential": "bfgroup...",
     "savedAt": "2025-10-01T00:00:00.000Z"
   }
   ```
   It then calls `clientShareManager.saveShare(share)`.
5. The renderer issues `ipcRenderer.invoke('save-share', share)`. The main-process `ShareManager.saveShare` writes the JSON to `${appData}/igloo/shares/${share.id}.json`, creating the directory on demand.

## Loading Shares Later (`ShareList.tsx`, `LoadShare.tsx`)
- `ShareList` retrieves saved entries through `clientShareManager.getShares()`, displays metadata, and passes the encrypted payload to `LoadShare`.
- Loading prompts for the password again, derives the same secret, decrypts the share, and verifies the plaintext starts with `bfshare`. The decrypted share is then available for signing workflows.
- Pubkey hints and other metadata come from `decodeGroup` and optional `share.shareCredential` fields when present.

## Finishing the Session
- Clicking **Finish** in the `Keyset` view displays a confirmation modal. Confirming clears `keysetData` in `App`, removing the plaintext keyset from memory. Saved shares remain on disk; unsaved shares are lost.

## Replicating the Flow in a CLI
1. Collect keyset parameters (name, total, threshold, nsec) and validate uniqueness against `${appData}/igloo/shares/*.json` using the same naming convention.
2. Convert `nsec` to hex and call `generateKeysetWithSecret` (or equivalent in the CLI environment) to obtain `groupCredential` and `shareCredentials`.
3. For each share, prompt the user to set a password, derive the secret with PBKDF2-SHA256 (c=32, dkLen=32) using a random 16-byte salt, and encrypt with AES-GCM identical to `encrypt_payload`.
4. Persist one JSON file per share under `appData/igloo/shares/`, matching the `id` and `name` patterns so the desktop and CLI apps interoperate.
5. Optionally, emit the plaintext share once (for copying or QR generation) and then wipe it from memory after saving.
6. Provide a `finish` action that forgets the in-memory keyset to mirror Igloo Desktop’s ephemeral handling.

These steps keep the CLI experience aligned with Igloo Desktop while preserving interoperability of saved shares and their encryption format.
