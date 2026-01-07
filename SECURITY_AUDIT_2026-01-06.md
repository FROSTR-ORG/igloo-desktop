# Igloo Desktop Security & Bug Audit Report

**Date:** January 6, 2026
**Auditor:** Claude Code
**Scope:** Full codebase review - security vulnerabilities, bugs, input validation

---

## Remediation Status

**Last Updated:** January 7, 2026

This document has been updated to reflect the security hardening work completed in the `refactor/electron-hardening` and `fix/input-validation` branches. Items marked with ✅ have been fully remediated.

| Status | Count | Description |
|--------|-------|-------------|
| ✅ Fixed | 18 | Issues fully remediated |
| ⚠️ Open | 23 | Issues requiring future attention |

### Completed Fixes

| Issue | Severity | Fix Description |
|-------|----------|-----------------|
| #1 Electron Security | CRITICAL → ✅ | contextIsolation, nodeIntegration, sandbox, preload script |
| #2 Missing CSP | CRITICAL → ✅ | Full CSP header added to index.html |
| #3 Numeric Validation | CRITICAL → ✅ | validatePositiveInteger() for threshold/keys in Create.tsx |
| #4 Password Length | CRITICAL → ✅ | Max 256 char limit in SaveShare, LoadShare, AddShare |
| #5 Threshold Validation | CRITICAL → ✅ | Bounds checking in Recover.tsx addShareInput() |
| #6 Insecure ws:// | HIGH → ✅ | CSP blocks ws://, only wss:// allowed |
| #8 File Permissions | HIGH → ✅ | Directory 0o700, files 0o600 |
| #9 SSRF Protection | HIGH → ✅ | isPrivateOrReservedIp() blocks private IPs in relay URLs |
| #12 Empty Relay Fallback | HIGH → ✅ | echoRelays.ts falls back to DEFAULT_ECHO_RELAYS |
| #13 Whitespace Validation | HIGH → ✅ | value.trim().length > 0 checks across components |
| #14 Name Length Limit | HIGH → ✅ | 255 char max via validateShareName() |
| #15 Error Sanitization | HIGH → ✅ | sanitizeUserError() in AddShare.tsx |
| #16 Echo Cleanup | MEDIUM → ✅ | Uses preload API with proper cleanup functions |
| #18 IPC Validation | MEDIUM → ✅ | Zod schema validation on all IPC handlers |
| #19 Debug Mode | MEDIUM → ✅ | DEBUG_GROUP_AUTO set to false |
| #33 IPC Length Limits | LOW → ✅ | Length limits in Zod schemas |
| #39 Error Path Exposure | LOW → ✅ | sanitizeErrorForLog() function added |
| NEW Navigation Security | MEDIUM → ✅ | will-navigate and setWindowOpenHandler block external navigation |

---

## Executive Summary

This audit originally identified **41 issues** across security, reliability, and input validation categories. **18 issues have been remediated** across the Electron security hardening and input validation work (plus 1 new issue identified and fixed).

| Severity | Original | Fixed | Remaining |
|----------|----------|-------|-----------|
| Critical | 5 | 5 | 0 |
| High | 10 | 7 | 3 |
| Medium | 17 | 4 | 13 |
| Low | 9 | 2 | 7 |

---

## Critical Vulnerabilities

### 1. ✅ FIXED: Electron Security Misconfiguration

**Severity:** ~~CRITICAL~~ → REMEDIATED
**Location:** `src/main.ts:234-240`
**CWE:** CWE-94 (Code Injection)

**Original Issue:**
```typescript
// VULNERABLE (before fix)
webPreferences: {
    nodeIntegration: true,      // Allowed renderer access to Node.js
    contextIsolation: false     // No isolation between contexts
}
```

**Applied Fix:**
```typescript
// SECURE (current state)
webPreferences: {
  nodeIntegration: false,      // Prevent renderer from accessing Node.js APIs directly
  contextIsolation: true,      // Isolate renderer context from preload script
  sandbox: true,               // Enable Chromium sandbox for additional security
  preload: path.join(__dirname, 'preload.js'),  // Safe IPC bridge via contextBridge
}
```

**Remediation Details:**
- Created `src/preload.ts` with `contextBridge.exposeInMainWorld()` for safe IPC
- All renderer-to-main communication now goes through typed `window.electronAPI`
- Added runtime validation for IPC event data in preload script
- Updated `clientShareManager.ts` to use `window.electronAPI` instead of direct `ipcRenderer`
- Updated `Keyset.tsx` to use preload API for echo listeners
- Added security tests in `src/__tests__/integration/electron-security.test.ts`

---

### 2. ✅ FIXED: Missing Content Security Policy (CSP)

**Severity:** ~~CRITICAL~~ → REMEDIATED
**Location:** `index.html:16-27`
**CWE:** CWE-693 (Protection Mechanism Failure)

**Original Issue:** No CSP header was present, allowing unrestricted script execution and resource loading.

**Applied Fix:**
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self' wss:;
  object-src 'none';
  base-uri 'self';
  form-action 'none';
  frame-ancestors 'none';
">
```

**Remediation Details:**
- `script-src 'self'` blocks inline scripts and external script injection
- `connect-src 'self' wss:` restricts connections to same-origin and secure WebSockets only
- `object-src 'none'` prevents plugin-based attacks
- `frame-ancestors 'none'` prevents clickjacking
- `form-action 'none'` prevents form hijacking
- Added documentation comments explaining `'unsafe-inline'` for style-src (required for Tailwind)
- Added security tests validating CSP configuration

**Note:** `'unsafe-inline'` is required for `style-src` due to Tailwind CSS and React component libraries. This is documented in the HTML comments and is lower risk than script injection.

---

### 3. ✅ FIXED: Unvalidated Numeric Inputs (Threshold/Keys)

**Severity:** ~~CRITICAL~~ → REMEDIATED
**Location:** `src/components/Create.tsx:56-88`
**CWE:** CWE-20 (Improper Input Validation)

**Original Issue:**
```tsx
<Input
  type="number"
  min={2}
  value={totalKeys}
  onChange={(e) => setTotalKeys(Number(e.target.value))}
/>
// No max limit, no NaN/Infinity validation
```

**Applied Fix:**
```typescript
// Centralized validation in src/lib/validation.ts
export function validatePositiveInteger(
  input: string | number,
  min: number,
  max: number,
  fieldName: string
): NumericValidationResult {
  const num = typeof input === 'string' ? parseInt(input, 10) : input;
  if (!Number.isFinite(num)) return { isValid: false, ... };
  if (!Number.isInteger(num)) return { isValid: false, ... };
  if (num < min || num > max) return { isValid: false, ... };
  return { isValid: true, value: num };
}

// In Create.tsx
const handleTotalKeysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const result = validatePositiveInteger(
    e.target.value,
    VALIDATION_LIMITS.TOTAL_KEYS_MIN,
    VALIDATION_LIMITS.TOTAL_KEYS_MAX,
    'Total keys'
  );
  if (result.value !== null) setTotalKeys(result.value);
  setTotalKeysError(result.error);
};
```

**Remediation Details:**
- Added `validatePositiveInteger()` utility with NaN, Infinity, and bounds checking
- Both totalKeys and threshold inputs use validated handlers
- Cross-field validation ensures threshold <= totalKeys
- Error messages displayed when validation fails
- Button disabled when validation errors exist

---

### 4. ✅ FIXED: No Maximum Password Length

**Severity:** ~~CRITICAL~~ → REMEDIATED
**Location:** `src/components/SaveShare.tsx`, `AddShare.tsx`, `LoadShare.tsx`
**CWE:** CWE-400 (Uncontrolled Resource Consumption)

**Original Issue:**
```tsx
if (!value.trim()) {
  setIsPasswordValid(false);
  setPasswordError('Password is required');
} else if (value.length < 8) {  // Only minimum check!
  setIsPasswordValid(false);
} else {
  setIsPasswordValid(true);
}
```

**Applied Fix:**
```typescript
// In all password handlers (SaveShare, LoadShare, AddShare):
} else if (value.length > VALIDATION_LIMITS.PASSWORD_MAX) {
  setIsPasswordValid(false);
  setPasswordError(`Password must be ${VALIDATION_LIMITS.PASSWORD_MAX} characters or less`);
}

// VALIDATION_LIMITS.PASSWORD_MAX = 256
```

**Remediation Details:**
- Added max 256 character limit to SaveShare.tsx, LoadShare.tsx, and AddShare.tsx
- Used centralized `VALIDATION_LIMITS.PASSWORD_MAX` constant
- Error message displayed when limit exceeded
- Prevents PBKDF2 DoS with extremely long inputs

---

### 5. ✅ FIXED: Insufficient Threshold Validation in Recovery

**Severity:** ~~CRITICAL~~ → REMEDIATED
**Location:** `src/components/Recover.tsx`
**CWE:** CWE-20 (Improper Input Validation)

**Original Issue:**
```tsx
const addShareInput = () => {
  if (sharesInputs.length < currentThreshold) {
    // What if currentThreshold is 0, -1, or undefined?
    setSharesInputs([...sharesInputs, ""]);
    setSharesValidity([...sharesValidity, { isValid: false }]);
  }
};
```

**Applied Fix:**
```typescript
const addShareInput = () => {
  // Validate currentThreshold before allowing more inputs
  if (
    typeof currentThreshold !== 'number' ||
    !Number.isInteger(currentThreshold) ||
    currentThreshold < VALIDATION_LIMITS.THRESHOLD_MIN ||
    currentThreshold > VALIDATION_LIMITS.THRESHOLD_MAX
  ) {
    return;
  }
  if (sharesInputs.length < currentThreshold) {
    setSharesInputs([...sharesInputs, '']);
    setSharesValidity([...sharesValidity, { isValid: false }]);
  }
};
```

**Remediation Details:**
- Added type check (`typeof currentThreshold !== 'number'`)
- Added integer check (`Number.isInteger()`)
- Added bounds validation (2-100 via `VALIDATION_LIMITS`)
- Early return prevents state explosion from invalid threshold values

---

## High Severity Issues

### 6. ✅ FIXED: Insecure WebSocket Protocol (ws://) Allowed

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `index.html:22` (CSP), `src/lib/echoRelays.ts:16-28` (code)
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)

**Original Issue:** The relay URL normalization code accepted both `ws://` and `wss://` protocols.

**Applied Fix:**
The Content Security Policy now enforces secure WebSocket connections:
```html
connect-src 'self' wss:;
```

**Remediation Details:**
- CSP `connect-src` directive only allows `wss:` (secure WebSocket), blocking `ws://`
- Any attempt to connect to an insecure `ws://` relay will be blocked by the browser
- Added comment in CSP documentation noting this intentional restriction
- The relay normalization code still accepts `ws://` URLs for backwards compatibility, but the browser will refuse to connect

**Note:** This is a defense-in-depth approach. The CSP provides browser-level enforcement even if application code doesn't validate the protocol.

---

### 7. Password Memory Exposure

**Severity:** HIGH
**Location:** `src/components/SaveShare.tsx:70-94`
**CWE:** CWE-316 (Cleartext Storage of Sensitive Information in Memory)

```typescript
if (onSave) {
  onSave(password, salt, encryptedShare);  // PASSWORD PASSED TO CALLBACK
}
setPassword('');  // Cleared in state but already exposed
```

**Impact:**
- Password remains in function scope and React state object memory
- Memory forensics can recover plaintext passwords
- React DevTools can inspect state values
- Unnecessary exposure in callback parameters

**Recommendation:**
- Only pass `salt` and `encryptedShare` to `onSave`
- Use Web Crypto API with `extractable: false`
- Consider secure memory clearing patterns

---

### 8. ✅ FIXED: No File Permission Validation

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `src/lib/shareManager.ts:37-44, 152`
**CWE:** CWE-276 (Incorrect Default Permissions)

**Original Issue:** Shares directory/files created with default umask (often 022 = world-readable).

**Applied Fix:**
```typescript
// Directory: mode 0o700 (owner-only access)
await fs.promises.mkdir(this.sharesPath, { recursive: true, mode: 0o700 });

// Files: mode 0o600 (owner read/write only)
await fs.promises.writeFile(filePath, JSON.stringify(share, null, 2), { mode: 0o600 });
```

**Remediation Details:**
- Directory permissions set to 0o700 (rwx------)
- File permissions set to 0o600 (rw-------)
- Added SECURITY comments documenting rationale
- Note: mode parameter ignored on Windows (uses ACLs), acceptable behavior
- Added security tests validating permissions are set

---

### 9. ✅ FIXED: Relay URL SSRF Potential

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `src/lib/validation.ts`
**CWE:** CWE-918 (Server-Side Request Forgery)

**Original Issue:**
```typescript
// Hostname validation didn't block private IP ranges
if (!formatted.startsWith('ws://') && !formatted.startsWith('wss://')) {
  formatted = `wss://${formatted}`;
}
```

**Applied Fix:**
```typescript
// SSRF Protection: Block private and reserved IP ranges
function isPrivateOrReservedIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  if (parts[0] === 10) return true;                                      // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true;                 // 192.168.0.0/16
  if (parts[0] === 127) return true;                                     // loopback
  if (parts[0] === 169 && parts[1] === 254) return true;                 // link-local
  if (parts[0] === 0) return true;                                       // 0.0.0.0/8
  return false;
}

// In isValidHostname():
if (hostname === 'localhost') return false;
if (isPrivateOrReservedIp(hostname)) return false;
```

**Remediation Details:**
- Added `isPrivateOrReservedIp()` function to detect RFC 1918 and reserved addresses
- Updated `isValidHostname()` to block localhost explicitly
- Updated `isValidHostname()` to call `isPrivateOrReservedIp()` for IP address hostnames
- Tests added covering all private IP ranges and edge cases

---

### 10. Race Condition in Signer Startup

**Severity:** HIGH
**Location:** `src/components/Signer.tsx:861-957`
**CWE:** CWE-362 (Race Condition)

```typescript
const handleStartSigner = async () => {
  setIsConnecting(true);

  const result = await createConnectedNode({...});  // Long async operation
  // If component unmounts here, following state updates are on unmounted component
  registerNode(result.node);
  updateSignerRunning(true);  // Memory leak if unmounted
}
```

**Impact:**
- Memory leaks from state updates on unmounted components
- Console warnings about memory leaks
- Stale closures using outdated state
- Potential crashes from invalid references

**Recommendation:**
```typescript
const handleStartSigner = async () => {
  const abortController = new AbortController();
  setIsConnecting(true);

  try {
    const result = await createConnectedNode({...});
    if (abortController.signal.aborted || !isMountedRef.current) return;
    // ... rest of function
  } finally {
    // cleanup
  }
}
```

---

### 11. Keep-Alive Timer Not Cleaned Up

**Severity:** HIGH
**Location:** `src/lib/signer-keepalive.ts:326-330`
**CWE:** CWE-401 (Memory Leak)

```typescript
finally {
  tickInProgress = false;
  if (isRunning) {
    timer = setTimeout(() => {
      void tick();  // Schedules next tick, may never be cleared
    }, resolvedOptions.heartbeatMs);
  }
}
```

**Impact:**
- Timer continues running after component unmount
- Orphaned references to destroyed node objects
- Memory leak from accumulated timer handles
- Stale callbacks executing on invalid state

**Recommendation:**
- Ensure `stop()` always clears timer synchronously before returning
- Add mounted check before scheduling next tick

---

### 12. ✅ FIXED: Empty Relay List Not Prevented

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `src/lib/echoRelays.ts`
**CWE:** CWE-754 (Improper Check for Unusual or Exceptional Conditions)

**Original Issue:**
```typescript
relays = dedupe([...explicit, ...defaults, ...group]);
// If all are empty: relays = []
```

**Applied Fix:**
```typescript
relays = dedupe([...explicit, ...defaults, ...group]);

// SECURITY: Ensure we always have at least one relay to prevent silent failures
// If all relay sources are empty, fall back to hardcoded defaults from @frostr/igloo-core
if (relays.length === 0) {
  console.warn('[echoRelays] No relays configured from any source, using hardcoded fallbacks');
  relays = normalizeList(DEFAULT_ECHO_RELAYS);
}
```

**Remediation Details:**
- Added fallback to `DEFAULT_ECHO_RELAYS` from `@frostr/igloo-core` when all sources are empty
- Warning logged to help diagnose relay configuration issues
- Prevents silent failure where signer appears active but has no relay connections

---

### 13. ✅ FIXED: Whitespace-Only Input Accepted

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `src/components/Create.tsx`, `AddShare.tsx`, `Recover.tsx`
**CWE:** CWE-20 (Improper Input Validation)

**Original Issue:**
```tsx
const handleNameChange = (value: string) => {
  if (value.trim()) {  // "   " is truthy as string!
    // ... validation
  }
}
```

**Applied Fix:**
```typescript
// In Create.tsx - using validateShareName() utility:
const result = validateShareName(value, existingNames);
// validateShareName() trims and checks length > 0

// In Recover.tsx:
if (value.trim().length > 0) {
  // ... validation
}
```

**Remediation Details:**
- Create.tsx now uses `validateShareName()` which properly validates trimmed length
- Recover.tsx updated to use `value.trim().length > 0` check
- AddShare.tsx uses `trimmed.length === 0` pattern for empty check
- Empty and whitespace-only inputs now properly rejected

---

### 14. ✅ FIXED: No Upper Bound on Share Name Length

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `src/components/Create.tsx`, `AddShare.tsx`
**CWE:** CWE-20 (Improper Input Validation)

**Original Issue:** No validation for extremely long share names that could exceed filesystem path limits or cause QR generation failures.

**Applied Fix:**
```typescript
// In Create.tsx - using validateShareName() utility:
const result = validateShareName(value, existingNames);
// validateShareName() enforces VALIDATION_LIMITS.NAME_MAX (255 chars)

// In AddShare.tsx:
if (trimmed.length > VALIDATION_LIMITS.NAME_MAX) {
  setNameError(`Share name must be ${VALIDATION_LIMITS.NAME_MAX} characters or less`);
  return;
}
```

**Remediation Details:**
- Create.tsx now uses `validateShareName()` which enforces 255 char max
- AddShare.tsx checks against `VALIDATION_LIMITS.NAME_MAX`
- Error messages displayed when limit exceeded
- Prevents filesystem path limit issues and QR generation failures

---

### 15. ✅ FIXED: Malformed Credentials Expose Stack Traces

**Severity:** ~~HIGH~~ → REMEDIATED
**Location:** `src/components/AddShare.tsx`
**CWE:** CWE-209 (Information Exposure Through an Error Message)

**Original Issue:**
```typescript
catch (error) {
  setIsGroupValid(false);
  setGroupError('Failed to decode group: ' + (error instanceof Error ? error.message : String(error)));
  // Error message could expose cryptographic internals
}
```

**Applied Fix:**
```typescript
// In src/lib/validation.ts:
export function sanitizeUserError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred';
  }
  const msg = error.message.toLowerCase();
  if (msg.includes('decode') || msg.includes('parse') || msg.includes('invalid')) {
    return 'Invalid credential format';
  }
  if (msg.includes('checksum')) {
    return 'Credential checksum failed - data may be corrupted';
  }
  if (msg.includes('length')) {
    return 'Input data has invalid length';
  }
  if (msg.includes('encrypt') || msg.includes('decrypt')) {
    return 'Encryption/decryption operation failed';
  }
  return 'Operation failed. Please check your input and try again.';
}

// In AddShare.tsx:
catch (error) {
  setIsGroupValid(false);
  setGroupError('Failed to decode group: ' + sanitizeUserError(error));
}
```

**Remediation Details:**
- Added `sanitizeUserError()` utility that maps internal errors to user-friendly messages
- Applied to all credential decode catch blocks in AddShare.tsx
- Pattern matching on error message keywords to provide relevant but safe error messages
- Internal details no longer exposed to the UI

---

## Medium Severity Issues

### 16. ✅ FIXED: Echo Listener Cleanup Fails Silently

**Severity:** ~~MEDIUM~~ → REMEDIATED
**Location:** `src/components/Keyset.tsx:199-222`

**Original Issue:**
```typescript
// Old approach - direct ipcRenderer with manual listener management
ipcRenderer.on('echo-received', handleIpcEcho as never);
// ... later ...
ipcRenderer.removeListener('echo-received', handleIpcEcho as never);
```

**Applied Fix:**
```typescript
// New approach - preload API returns cleanup function
const cleanupEchoListener = window.electronAPI.onEchoReceived((payload) => {
  // ... handle payload
});

return () => {
  cleanupEchoListener();  // Proper cleanup via returned function
  void window.electronAPI.echoStop({ listenerId }).catch(() => { /* noop */ });
};
```

**Remediation Details:**
- Echo event listeners now use the preload API which returns cleanup functions
- `onEchoReceived` and `onEchoError` in preload.ts wrap `ipcRenderer.on` and return `removeListener` functions
- Cleanup is guaranteed by calling the returned function in useEffect cleanup
- The `/* noop */` for `echoStop` failures is intentional - the listener is already cleaned up locally

---

### 17. Unbounded Log Array Growth

**Location:** `src/components/Signer.tsx:307-322`

```typescript
setLogs(prev => {
  return [...prev, { timestamp, type, message, data, id }];
  // Array grows forever
});
```

**Impact:** Memory leak over long signer sessions

**Recommendation:** Implement circular buffer with max 1000 entries

---

### 18. ✅ FIXED: IPC Input Validation Incomplete

**Severity:** ~~MEDIUM~~ → REMEDIATED
**Location:** `src/main.ts`

**Original Issue:** Only validates string type, not format (id patterns, hex salt, base64url share).

**Applied Fix:** Comprehensive Zod schema validation for all IPC handlers:
- `ShareIdSchema`: Alphanumeric with max 255 chars, regex validation
- `HexSaltSchema`: Hex format validation, min 32 chars (16 bytes)
- `SaveShareSchema`: Full share object validation with field limits
- `RelayPlanArgsSchema`: Relay plan arguments validation
- `EchoStartArgsSchema`: Echo listener arguments validation
- `EchoStopArgsSchema`: Echo stop arguments validation

**Remediation Details:**
- All IPC handlers now use `.safeParse()` for input validation
- Schema violations return structured error messages
- Added security tests validating schema definitions and handler usage

---

### 19. ✅ FIXED: Debug Mode Hard-Coded

**Severity:** ~~MEDIUM~~ → REMEDIATED
**Location:** `src/lib/clientShareManager.ts:4-6`

**Original Issue:**
```typescript
const DEBUG_GROUP_AUTO = true;  // ALWAYS ENABLED - leaked sensitive data
```

**Applied Fix:**
```typescript
// Debug helper for group auto-population
// Set to true locally for debugging share lookups (do not commit as true)
const DEBUG_GROUP_AUTO = false;
```

**Remediation Details:**
- Debug flag now defaults to `false`
- Added comment warning against committing with `true`
- Sensitive share data no longer logged to console in production

---

### 20. Weak Legacy PBKDF2 Iterations

**Location:** `src/components/LoadShare.tsx:65-83`

```typescript
if (share.version == null) {
  targetIterations = PBKDF2_ITERATIONS_LEGACY;  // 32 iterations - WEAK
}
```

**Impact:** Legacy shares crackable in milliseconds with GPU

**Recommendation:** Force re-encryption on first load with modern iteration count

---

### 21. QR Code Data Size Not Validated

**Location:** `src/components/Keyset.tsx`

**Impact:** Credentials >2953 bytes fail QR generation silently

---

### 22. Duplicate Shares in Recovery Not Detected

**Location:** `src/components/Recover.tsx:331-400`

**Impact:** User adds same share twice, recovery fails at crypto layer with confusing error

---

### 23. Password Whitespace Differences

**Location:** `src/components/SaveShare.tsx:52-63`

```typescript
} else if (pass !== confirm) {  // Exact equality includes trailing spaces
```

**Impact:** "Password " vs "Password" don't match - locks user out

---

### 24. LoadShare Validates Only Prefix

**Location:** `src/components/LoadShare.tsx:93-101`

```typescript
if (!decryptedShare.startsWith('bfshare')) {
  // Error
}
// No further structure validation
```

**Impact:** Accepts corrupted shares matching prefix, fails downstream

---

### 25. Relay Config No Schema Validation

**Location:** `src/lib/echoRelays.ts:59-84`

**Impact:** Malicious relays loaded silently from compromised config file

---

### 26. Global console.warn Override

**Location:** `src/components/Signer.tsx:554-582`

**Impact:** Masks real warnings during async cleanup operations

---

### 27. Async Decrypt Not Cancellable

**Location:** `src/components/LoadShare.tsx:55-121`

**Impact:** Modal closes before decryption completes - callback may fire on unmounted component

---

### 28. Silent Failure on Share Deletion

**Location:** `src/components/ShareList.tsx:131-141`

**Impact:** User thinks share deleted when deletion failed - no error shown

---

### 29. Stale closeBridge Reference

**Location:** `src/lib/signer-keepalive.ts:95-171`

**Impact:** If both detachment methods fail, stale listener reference persists

---

### 30. Timeout Promise Memory Leak

**Location:** `src/lib/signer-keepalive.ts:295-298`

```typescript
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('heartbeat timeout')), resolvedOptions.timeoutMs);
});
// Never cleaned up if race resolves early
```

**Impact:** Dangling timeout handles accumulate over long sessions

---

### 31. Share ID Collision Not Checked

**Location:** `src/components/AddShare.tsx:350-352`

**Impact:** Could overwrite existing share with same normalized name

---

### 32. Type Coercion Not Protected

**Location:** `src/components/Create.tsx:242, 266`

**Impact:** `Number("")` = 0 and `Number("abc")` = NaN silently accepted

---

## Low Severity Issues

### 33. ✅ FIXED: No IPC Input Length Limits

**Severity:** ~~LOW~~ → REMEDIATED
**Location:** `src/main.ts`

**Original Issue:** Multi-MB credentials cause memory exhaustion.

**Applied Fix:** Length limits incorporated into Zod schemas:
- `shareId`: max 255 chars
- `name`: max 255 chars
- `share`: max 10,000 chars
- `salt`: 32-128 hex chars
- `groupCredential`: max 5,000 chars
- `relay URLs`: max 500 chars each, max 50 relays
- `shareCredentials`: max 5,000 chars each, max 100 shares
- `listenerId`: max 100 chars

---

### 34. No IPC Rate Limiting

**Location:** `src/main.ts:261-303`

**Impact:** DoS via rapid IPC calls

---

### 35. New ShareManager Instance Per Call

**Location:** `src/lib/shareManager.ts:192-195`

**Impact:** Redundant initialization overhead

---

### 36. Inefficient Log Duplicate Detection

**Location:** `src/components/Signer.tsx:267-305`

**Impact:** O(n) JSON serialization per event

---

### 37. Echo Listener No Success Feedback

**Location:** `src/components/Keyset.tsx:219-227`

**Impact:** User doesn't know if echo listening is actually active

---

### 38. Group Credential Lookup Not Debounced

**Location:** `src/components/Recover.tsx:194-241`

**Impact:** Multiple unnecessary file I/O on each keystroke

---

### 39. ✅ FIXED: Error Messages Expose Paths

**Severity:** ~~LOW~~ → REMEDIATED
**Location:** `src/main.ts`

**Original Issue:** Information disclosure of application data paths.

**Applied Fix:** Added `sanitizeErrorForLog()` function that:
- Replaces Unix-style absolute paths with `<path>/filename`
- Replaces Windows-style paths with `<path>\filename`
- Applied to all IPC handler error logging

---

### 40. Relay URL No Max Length

**Location:** `src/lib/validation.ts:178-252`

**Impact:** Potential OOM with extremely long URLs

---

### 41. Webpack No Security Plugins

**Location:** `webpack.config.cjs`

**Impact:** No CSP header generation, no subresource integrity

---

## Appendix: Quick Reference

### Files Requiring Critical Fixes

| File | Critical Issues | Status |
|------|----------------|--------|
| `src/main.ts` | #1 Electron config, #18 IPC validation | ✅ Fixed |
| `index.html` | #2 CSP header | ✅ Fixed |
| `src/lib/shareManager.ts` | #8 File permissions | ✅ Fixed |
| `src/components/Create.tsx` | #3 Numeric validation, #13-14 Whitespace/name | ✅ Fixed |
| `src/components/SaveShare.tsx` | #4 Password length | ✅ Fixed |
| `src/components/AddShare.tsx` | #4 Password length, #14-15 Name/errors | ✅ Fixed |
| `src/components/LoadShare.tsx` | #4 Password length | ✅ Fixed |
| `src/components/Recover.tsx` | #5 Threshold validation, #13 Whitespace | ✅ Fixed |
| `src/lib/validation.ts` | #9 SSRF protection | ✅ Fixed |
| `src/lib/echoRelays.ts` | #12 Empty relay fallback | ✅ Fixed |

### New Files Added for Security

| File | Purpose |
|------|---------|
| `src/preload.ts` | Secure IPC bridge using contextBridge |
| `src/__tests__/integration/electron-security.test.ts` | Security configuration tests (expanded) |

### CWE References

- CWE-20: Improper Input Validation
- CWE-94: Improper Control of Generation of Code
- CWE-209: Information Exposure Through Error Message
- CWE-276: Incorrect Default Permissions
- CWE-316: Cleartext Storage in Memory
- CWE-319: Cleartext Transmission
- CWE-362: Race Condition
- CWE-400: Uncontrolled Resource Consumption
- CWE-401: Memory Leak
- CWE-693: Protection Mechanism Failure
- CWE-754: Improper Check for Exceptional Conditions
- CWE-918: Server-Side Request Forgery

---

## Changelog

### 2026-01-07 - Input Validation Hardening

**Branch:** `fix/input-validation`

**Summary:** Completed comprehensive input validation fixes covering all critical and high severity React component validation issues.

**Changes:**
1. **Numeric Validation** (Critical #3): Added `validatePositiveInteger()` utility, applied to Create.tsx threshold/keys inputs with NaN/Infinity/bounds checking
2. **Password Length Limits** (Critical #4): Added 256-char max limit to SaveShare, LoadShare, AddShare components
3. **Threshold Validation** (Critical #5): Added type/integer/bounds checks in Recover.tsx `addShareInput()`
4. **SSRF Protection** (High #9): Added `isPrivateOrReservedIp()` to block RFC 1918 and reserved addresses in relay URLs
5. **Empty Relay Fallback** (High #12): Added fallback to DEFAULT_ECHO_RELAYS when all relay sources empty
6. **Whitespace Validation** (High #13): Fixed `value.trim().length > 0` checks across Create, AddShare, Recover
7. **Name Length Limits** (High #14): Added 255-char max via `validateShareName()` utility
8. **Error Sanitization** (High #15): Added `sanitizeUserError()` to prevent stack trace exposure in AddShare

**New Utilities in validation.ts:**
- `VALIDATION_LIMITS` - Centralized constants for all limits
- `validatePositiveInteger()` - Numeric input validation with bounds
- `validateShareName()` - Name validation with length/duplicate checking
- `validatePasswordLength()` - Simple password length validation
- `sanitizeUserError()` - User-friendly error message sanitization
- `isPrivateOrReservedIp()` - SSRF protection for relay URLs

**Files Modified:**
- `src/lib/validation.ts` - New validation utilities and SSRF protection
- `src/components/Create.tsx` - Numeric validation, name length
- `src/components/SaveShare.tsx` - Password max length
- `src/components/LoadShare.tsx` - Password min/max length
- `src/components/AddShare.tsx` - Password max, name length, error sanitization
- `src/components/Recover.tsx` - Threshold validation, whitespace fix
- `src/lib/echoRelays.ts` - Empty relay fallback
- `src/__tests__/lib/validation.test.ts` - 49 new tests for validation utilities
- `src/__tests__/integration/userInputValidation.test.ts` - Updated for SSRF protection

**Test Results:** 112 tests passing (49 new validation tests)

---

### 2026-01-07 - IPC Hardening & File Permissions

**Branch:** `refactor/electron-hardening`

**Summary:** Completed Electron-specific security hardening with Zod schema validation, file permissions, error sanitization, and navigation security.

**Changes:**
1. **File Permissions** (High #8): Added `mode: 0o700` for directory, `mode: 0o600` for files
2. **IPC Validation** (Medium #18): Added comprehensive Zod schemas for all IPC handlers
3. **Input Length Limits** (Low #33): Length limits enforced via Zod schemas
4. **Error Path Sanitization** (Low #39): Added `sanitizeErrorForLog()` to prevent path disclosure
5. **Navigation Security** (NEW): Added `will-navigate` and `setWindowOpenHandler` to block external navigation and open links in system browser

**Files Modified:**
- `src/main.ts` - Zod schemas, handler validation, error sanitization, navigation handlers
- `src/lib/shareManager.ts` - File/directory permissions
- `src/__tests__/integration/electron-security.test.ts` - New security tests
- `src/__tests__/lib/shareManager.test.ts` - Updated for permission params
- `src/__tests__/integration/computeRelayPlan.test.ts` - Updated for Zod validation

**Remaining Work:** 31 issues remain open, with 3 critical issues requiring attention (#3, #4, #5 - React input validation).

---

### 2026-01-06 - Electron Security Hardening

**Branch:** `refactor/electron-hardening`

**Summary:** Implemented comprehensive Electron security hardening to address the most critical vulnerabilities identified in the initial audit.

**Changes:**
1. **Electron Configuration** (Critical #1): Enabled `contextIsolation`, disabled `nodeIntegration`, enabled `sandbox`, added preload script
2. **Content Security Policy** (Critical #2): Added comprehensive CSP meta tag to index.html
3. **Secure WebSocket Enforcement** (High #6): CSP restricts `connect-src` to `wss:` only
4. **Echo Listener Cleanup** (Medium #16): Refactored to use preload API with proper cleanup functions
5. **Debug Mode Disabled** (Medium #19): Set `DEBUG_GROUP_AUTO` to false

**Files Modified:**
- `src/main.ts` - BrowserWindow security settings
- `index.html` - CSP header
- `src/preload.ts` - New secure IPC bridge
- `src/lib/clientShareManager.ts` - Use window.electronAPI
- `src/components/Keyset.tsx` - Use preload API for echo
- `src/components/AddShare.tsx` - Use preload API for relay planning
- `src/__tests__/*` - Updated tests for new API

---

*Report generated by Claude Code security audit*
*Last updated: January 7, 2026*
