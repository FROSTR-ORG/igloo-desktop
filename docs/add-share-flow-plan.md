# Add Existing Share Flow — Implementation Plan

## Summary

Introduce an "Add Share" entry point that lets users import and persist an
individual signer share without generating a brand-new keyset. The flow should
mirror the existing create → save experience (password prompt, share-file v1
output) while reusing our validation, decoding, and persistence infrastructure.

## Goals & Non-goals

- **Goals**
  - Provide a top-level CTA alongside **Create** and **Recover** that opens an
    import modal/wizard.
  - Require the user to paste a `bfgroup…` credential first, derive threshold,
    indices, and peer pubkeys, and display them for confirmation.
  - Allow importing exactly one share credential per iteration with password
    protection identical to the create flow (`SaveShare`).
  - Persist the new share to disk following `llm/context/share-file-version1.md`
    (including policy defaults, metadata, version tagging).
  - Update in-memory state so the newly added share appears in the Share List
    without app restart.
- **Non-goals**
  - Generating missing shares or reconstructing the private key (covered by
    existing create/recover flows).
  - Editing existing saved shares or policies beyond what currently exists.
  - Handling multiple share imports in a single batch (initial release focuses
    on one share at a time to keep UX simple).

## User Flow Outline

1. User clicks **Add Share** button (new CTA next to Create / Recover).
2. Modal/wizard opens:
   - **Step 1 – Group Credential**: paste `bfgroup…`; validate via
     `validateGroup`; decode with `decodeGroup`. Display threshold, member count,
     and table of commits (index + normalized pubkey).
   - **Step 2 – Share Credential**: prompt for one `bfshare…`; validate with
     `validateShare` and `decodeShare`; ensure index belongs to pasted group;
     surface determined pubkey/slot.
   - **Step 3 – Save**: reuse the password dialog pattern from `SaveShare`
     (async PBKDF2 with progress overlay). On success, call the same
     `clientShareManager.saveShare` path and trigger ShareList refresh.
   - Provide contextual error states for validation failures, mismatched
     indices, or persistence issues.
3. Confirmation screen/toast indicates success, offering quick access to the
   Signer tab.

## UI & Component Work

- **Entry Point**: in `src/components/App.tsx`, add a third button near the
  existing CTA cluster or Tabs list. Follow Tailwind utility conventions.
- **Modal/Stepper**: implement a new component (e.g. `AddShareWizard`) under
  `src/components/` that manages the three steps. Consider composing existing
  building blocks:
  - InputWithValidation for credential fields.
  - Reuse/abstract the share metadata viewer used in Signer when expanded.
  - Reuse `SaveShare` internals where possible (extract common logic if needed).
- **State Updates**: the wizard should accept callbacks for success/cancel and
  rely on `clientShareManager` to persist. After save, instruct ShareList to
  refetch or push the new entry into state.

## Validation & Error Handling

- Group step: block progression unless `validateGroup` succeeds. On success,
  store decoded group for later index cross-checks.
- Share step: ensure `decodeShare` index exists in decoded group; warn if the
  share index already exists in saved shares (optional but recommended).
- Save step: handle async errors from `derive_secret_async`, encryption, or
  filesystem write with inline feedback and spinner reset.
- Persist policy defaults (`allowSend: true`, `allowReceive: true`) and
  populate metadata (e.g., binder serial if available from group/share data).

## Data Layer Requirements

- No new IPC endpoints—reuse `clientShareManager.saveShare` (already wired to
  Electron main process) and `getShares` for refresh.
- Ensure share objects include:
  - `version: CURRENT_SHARE_VERSION`
  - `policy` object with defaults and timestamps
  - `savedAt` ISO string
  - Optionally capture binder serial or commit index inside `metadata` for
    share listing heuristics.

## Testing Plan

- **Unit**
  - Add tests covering the wizard’s step transitions, validation edge cases,
    and error handling.
  - Extend encryption tests if any new utility functions are introduced.
- **Integration**
  - Expand `share-lifecycle` test to simulate Add flow: inject group/share
    credentials, trigger save, verify `clientShareManager.saveShare` payload.
  - Ensure ShareList reflects the newly added share without reload.
- **Manual**
  - Import valid share, confirm Signer launches and policies persist.
  - Attempt invalid combinations (wrong share for group, malformed credentials,
    duplicate IDs) and verify graceful errors.

## Open Questions / Follow-ups

1. Should the wizard support importing multiple shares sequentially before
   closing (e.g., keep group context and loop through share step)?
2. Do we want to auto-populate policy overrides from the decoded group (e.g.,
   disable outbound for offline peers) or keep defaults until user edits?
3. Any additional metadata we should persist (e.g., label, notes) during import?

## Next Steps

1. Confirm UX copy/design with stakeholders (button label, modal layout).
2. Implement `AddShareWizard` component, integrating with existing utilities.
3. Wire the new CTA in `App.tsx` and ensure ShareList can refresh in place.
4. Update documentation (README/workflow docs) to reference the new import path.
5. Execute automated and manual test plans prior to release.
