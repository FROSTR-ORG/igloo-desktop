import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShareManager, getAllShares } from './lib/shareManager.js';
import { computeRelayPlan } from './lib/echoRelays.js';
import {
  decodeGroup,
  DEFAULT_ECHO_RELAYS,
  startListeningForAllEchoes,
} from '@frostr/igloo-core';
import { SimplePool } from 'nostr-tools';
import {
  ShareIdSchema,
  SaveShareSchema,
  RelayPlanArgsSchema,
  EchoStartArgsSchema,
  EchoStopArgsSchema,
} from './lib/ipcSchemas.js';

// =============================================================================
// Error Sanitization
// =============================================================================

/**
 * Sanitize error messages to prevent leaking sensitive file paths.
 * SECURITY: Replaces absolute paths with placeholders, preserving only filenames.
 *
 * Handles both quoted paths (from Node.js errors) and unquoted paths.
 * Quoted paths can contain spaces (e.g., macOS "Application Support").
 * Unquoted paths stop at whitespace since boundaries are ambiguous.
 */
function sanitizeErrorForLog(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    // Quoted Unix paths: '/path/with spaces/file.txt' -> '<path>/file.txt'
    .replace(/(['"])(\/(?:[^/]+\/)+)([^/'"]*)\1/g, '$1<path>/$3$1')
    // Unquoted Unix paths: /path/to/file.txt -> <path>/file.txt
    .replace(/\/(?:[^/\s:]+\/)+([^/\s:]+)/g, '<path>/$1')
    // Quoted Windows paths: "C:\path\with spaces\file.txt" -> "<path>\file.txt"
    .replace(/(['"])([A-Za-z]:\\(?:[^\\]+\\)+)([^\\'"]*)(\1)/g, '$1<path>\\$3$1')
    // Unquoted Windows paths: C:\path\to\file.txt -> <path>\file.txt
    .replace(/[A-Za-z]:\\(?:[^\\:\s]+\\)+([^\\:\s]+)/g, '<path>\\$1');
}
// import type { BifrostNode } from '@frostr/igloo-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Internal type returned by startEchoMonitor */
type EchoListenerResult = {
  cleanup: () => void;
};

/** Type stored in activeEchoListeners map, includes disposed flag for race condition prevention */
type EchoListener = {
  cleanup: () => void;
  /** Flag to prevent double-cleanup race conditions */
  disposed: boolean;
};

const activeEchoListeners = new Map<string, EchoListener>();

/**
 * Safely cleanup an echo listener, preventing double-cleanup race conditions.
 * Sets disposed flag before calling cleanup to ensure idempotency.
 */
function safeCleanupListener(listener: EchoListener | undefined): void {
  if (!listener || listener.disposed) return;
  listener.disposed = true;
  try {
    listener.cleanup?.();
  } catch {
    // Ignore cleanup errors - listener may already be disposed
  }
}

// Minimal SimplePool shim: unwrap single-element filter arrays to a plain object.
// This matches igloo-cli/server behavior and avoids nested [[filter]] payloads
// that relays reject with "provided filter is not an object".
try {
  const poolProto = SimplePool?.prototype as typeof SimplePool.prototype & { __iglooSubscribeFixApplied?: boolean } | undefined;
  if (poolProto && !poolProto.__iglooSubscribeFixApplied) {
    const original = poolProto.subscribeMany as (relays: unknown, filter: unknown, params: unknown) => unknown;
    if (typeof original === 'function') {
      poolProto.subscribeMany = function patchedSubscribeMany(this: SimplePool, relays: unknown, filter: unknown, params: unknown) {
        if (Array.isArray(filter) && filter.length === 1 && filter[0] && typeof filter[0] === 'object' && !Array.isArray(filter[0])) {
          // unwrap [filter] -> filter
          return original.call(this, relays, filter[0], params);
        }
        return original.call(this, relays, filter, params);
      } as typeof poolProto.subscribeMany;
      Object.defineProperty(poolProto, '__iglooSubscribeFixApplied', { value: true });
    }
  }
} catch (error) {
  console.warn('[EchoBridge] Failed to apply SimplePool subscribeMany shim:', error);
}

// Legacy listener record removed; igloo-core manages nodes internally.

const startEchoMonitor = async (
  groupCredential: string,
  shareCredentials: string[],
  onEcho: (shareIndex: number, shareCredential: string, challenge?: string | null) => void
): Promise<EchoListenerResult> => {
  const handledShares = new Set<string>();
  let coreListener: { cleanup: () => void; isActive?: boolean } | null = null;

  let disposed = false;

  let decodedRelaySource: Record<string, unknown> | null = null;

  try {
    const rawGroup = decodeGroup(groupCredential) as unknown;
    const decodedGroup = (rawGroup && typeof rawGroup === 'object')
      ? (rawGroup as Record<string, unknown>)
      : {};
    decodedRelaySource = decodedGroup;
  } catch (error) {
    console.warn('[EchoBridge] Failed to decode group relay list:', error);
  }

  // Optional single-relay override for debugging / CI sync
  const envRelay = (process.env.IGLOO_TEST_RELAY ?? '').trim();
  const relayPlan = computeRelayPlan({
    groupCredential,
    decodedGroup: decodedRelaySource,
    envRelay,
    baseRelays: DEFAULT_ECHO_RELAYS
  });

  const notifyEcho = (shareIndex: number, shareCredential: string, challenge?: string | null) => {
    // Use a collision-safe tuple key to avoid aliasing on ':' or other separators.
    const key = JSON.stringify([shareIndex, shareCredential, challenge ?? null]);
    if (handledShares.has(key)) {
      return;
    }

    handledShares.add(key);
    onEcho(shareIndex, shareCredential, challenge ?? undefined);
  };

  // Parser to support new and old igloo-core callback signatures with strict types.
  type EchoDetails = { challenge?: string };
  interface EchoPayload { shareIndex: number; shareCredential: string; challenge?: string }
  const isEchoPayload = (v: unknown): v is EchoPayload => (
    !!v && typeof v === 'object' &&
    typeof (v as Record<string, unknown>).shareIndex === 'number' &&
    typeof (v as Record<string, unknown>).shareCredential === 'string'
  );
  const isEchoDetails = (v: unknown): v is EchoDetails => (
    !!v && typeof v === 'object' &&
    ('challenge' in (v as Record<string, unknown>) ? typeof (v as Record<string, unknown>).challenge === 'string' : true)
  );

  function handleCoreCallback(
    arg1: number | EchoPayload,
    arg2?: string | Record<string, unknown>,
    arg3?: unknown
  ): void {
    try {
      // Case 1: (subsetIndex: number, shareCredential: string, details?: { challenge?: string })
      if (typeof arg1 === 'number') {
        if (typeof arg2 !== 'string') {
          console.warn('[EchoBridge] Malformed echo callback (missing shareCredential string)', { arg2 });
          return;
        }
        let challenge: string | undefined;
        if (typeof arg3 === 'string') challenge = arg3;
        else if (isEchoDetails(arg3)) challenge = arg3?.challenge;
        notifyEcho(arg1, arg2, challenge);
        return;
      }

      // Case 2: (payload: { shareIndex, shareCredential, challenge? })
      if (isEchoPayload(arg1)) {
        notifyEcho(arg1.shareIndex, arg1.shareCredential, arg1.challenge);
        return;
      }

      console.warn('[EchoBridge] Malformed echo callback payload', { arg1, arg2, arg3 });
    } catch (err) {
      console.warn('[EchoBridge] Failed to parse echo callback payload', { err });
    }
  }

  // Start two listeners to avoid connect-all-or-fail on a combined set:
  // - one on the stable defaults
  // - one on the group's extra relays (if any)
  const listeners: Array<{ cleanup: () => void }> = [];

  const debugEnabled = ((process.env.IGLOO_DEBUG_ECHO ?? '').toLowerCase() === '1' || (process.env.IGLOO_DEBUG_ECHO ?? '').toLowerCase() === 'true');
  const debugLogger = debugEnabled
    ? ((level: string, message: string, data?: unknown) => {
        try { 
          console.log(`[echo-listen] ${level.toUpperCase()} ${message}`, data ?? ''); 
        } catch { 
          /* suppress potential log failure */
        }
      })
    : undefined;

  // Relay target tracking - scoped to this monitor instance to avoid cross-contamination
  const relayTargets: string[][] = [];
  const seenTargets = new Set<string>();

  const relayTargetKey = (relays: string[]): string => {
    const canonicalPieces = relays.map(relay => {
      try {
        const parsed = new URL(relay);
        const protocol = parsed.protocol.toLowerCase();
        const hostname = parsed.hostname.toLowerCase();
        const port = parsed.port ? `:${parsed.port}` : '';
        return `${protocol}//${hostname}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        const match = relay.match(/^(wss?):\/\/([^/?#]+)(.*)$/);
        if (match) {
          const scheme = match[1].toLowerCase();
          const authority = match[2].toLowerCase();
          const pathAndMore = match[3] ?? '';
          return `${scheme}://${authority}${pathAndMore}`;
        }
        return relay;
      }
    });
    canonicalPieces.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return canonicalPieces.join('|');
  };

  const registerTarget = (relays: string[]) => {
    if (relays.length === 0) return;
    const key = relayTargetKey(relays);
    if (seenTargets.has(key)) return;
    seenTargets.add(key);
    relayTargets.push(relays);
  };

  if (relayPlan.envRelays.length > 0) {
    registerTarget(relayPlan.envRelays);
  } else {
    registerTarget(relayPlan.defaultRelays);
    registerTarget(relayPlan.groupExtras);
  }

  if (relayTargets.length === 0 && relayPlan.relays.length > 0) {
    registerTarget(relayPlan.relays);
  }

  for (const relays of relayTargets) {
    const listener = startListeningForAllEchoes(
      groupCredential,
      shareCredentials,
      (subsetIndex: number, shareCredential: string, details?: unknown) => {
        if (disposed) return;
        handleCoreCallback(subsetIndex, shareCredential, details);
      },
      {
        relays,
        eventConfig: { enableLogging: debugEnabled, customLogger: debugLogger }
      }
    );
    listeners.push(listener);
  }

  coreListener = {
    cleanup: () => {
      for (const l of listeners) {
        try { l.cleanup?.(); } catch { /* ignore */ }
      }
    },
    isActive: true,
  };

  return {
    cleanup: () => {
      disposed = true;
      try { coreListener?.cleanup?.(); } catch {
        // ignore cleanup error
      }
      handledShares.clear();
    }
  };
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      // SECURITY: These settings are critical for app security
      nodeIntegration: false,      // Prevent renderer from accessing Node.js APIs directly
      contextIsolation: true,      // Isolate renderer context from preload script
      sandbox: true,               // Enable Chromium sandbox for additional security
      preload: path.join(__dirname, 'preload.js'),  // Safe IPC bridge via contextBridge
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'frostr-logo-transparent.png')
  });

  // In development, use the local file
  if (process.env.NODE_ENV === 'development') {
    win.loadFile('index.html');
  } else {
    // In production, use the path relative to the app bundle
    win.loadFile(path.join(app.getAppPath(), 'index.html'));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  // SECURITY: Prevent navigation to external URLs
  // This prevents the app window from being redirected to malicious sites
  win.webContents.on('will-navigate', (event, url) => {
    // Allow navigation to local files only (the app's own pages)
    if (!url.startsWith('file://')) {
      event.preventDefault();
      console.warn('[Security] Blocked navigation to external URL:', url);
    }
  });

  // SECURITY: Handle new window requests (e.g., target="_blank" links)
  // Open external links in the system browser, don't create new Electron windows
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Open in system browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    // Deny creating new Electron windows
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Initialize share manager
  const shareManager = new ShareManager();
  
  // Set up IPC handlers for share operations
  ipcMain.handle('get-shares', async () => {
    return getAllShares();
  });
  
  ipcMain.handle('save-share', async (_event: IpcMainInvokeEvent, share: unknown) => {
    try {
      // SECURITY: Validate input with Zod schema (includes length limits)
      const parseResult = SaveShareSchema.safeParse(share);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map(i => i.message).join(', ');
        console.warn('[ShareManager] save-share rejected: validation failed', { issues });
        return false;
      }
      return shareManager.saveShare(parseResult.data);
    } catch (err) {
      console.error('[ShareManager] save-share failed:', sanitizeErrorForLog(err));
      return false;
    }
  });
  
  ipcMain.handle('delete-share', async (_event: IpcMainInvokeEvent, shareId: unknown) => {
    try {
      // SECURITY: Validate share ID with Zod schema (includes length/format limits)
      const parseResult = ShareIdSchema.safeParse(shareId);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map(i => i.message).join(', ');
        console.warn('[ShareManager] delete-share rejected: validation failed', { issues });
        return false;
      }
      return shareManager.deleteShare(parseResult.data);
    } catch (err) {
      console.error('[ShareManager] delete-share failed:', sanitizeErrorForLog(err));
      return false;
    }
  });

  ipcMain.handle('open-share-location', async (_event: IpcMainInvokeEvent, shareId: unknown) => {
    try {
      // SECURITY: Validate share ID with Zod schema (includes length/format limits)
      const parseResult = ShareIdSchema.safeParse(shareId);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map(i => i.message).join(', ');
        console.warn('[ShareManager] open-share-location rejected: validation failed', { issues });
        return { ok: false };
      }
      const filePath = shareManager.getSharePath(parseResult.data);
      await shell.showItemInFolder(filePath);
      return { ok: true };
    } catch (error) {
      console.error('[ShareManager] open-share-location failed:', sanitizeErrorForLog(error));
      return { ok: false };
    }
  });

  ipcMain.handle('compute-relay-plan', async (_event: IpcMainInvokeEvent, args: unknown) => {
    try {
      // SECURITY: Validate input with Zod schema (includes length limits)
      const parseResult = RelayPlanArgsSchema.safeParse(args ?? {});
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map(i => i.message).join(', ');
        console.warn('[RelayPlan] compute-relay-plan rejected: validation failed', { issues });
        return { ok: false, reason: 'validation-failed', message: issues };
      }

      const { groupCredential, decodedGroup, explicitRelays, envRelay } = parseResult.data;

      // Fall back to reading IGLOO_RELAY from main process environment
      // (renderer can't access process.env due to sandbox/contextIsolation)
      const normalizedEnvRelay = envRelay?.trim() || process.env.IGLOO_RELAY?.trim() || undefined;

      const relayPlan = computeRelayPlan({
        groupCredential: groupCredential?.trim() || undefined,
        decodedGroup: decodedGroup ?? undefined,
        explicitRelays: explicitRelays?.filter(r => r.trim().length > 0) ?? undefined,
        envRelay: normalizedEnvRelay,
        baseRelays: DEFAULT_ECHO_RELAYS
      });

      return {
        ok: true,
        relayPlan: {
          relays: relayPlan.relays,
          envRelays: relayPlan.envRelays,
          defaultRelays: relayPlan.defaultRelays,
          groupRelays: relayPlan.groupRelays,
          explicitRelays: relayPlan.explicitRelays,
          groupExtras: relayPlan.groupExtras
        }
      };
    } catch (error) {
      console.error('[RelayPlan] Failed to compute relay plan:', sanitizeErrorForLog(error));
      return { ok: false, reason: 'computation-failed', message: 'Failed to compute relay plan' };
    }
  });

  ipcMain.handle('echo-start', async (event: IpcMainInvokeEvent, args: unknown) => {
    // SECURITY: Validate input with Zod schema (includes length limits)
    const parseResult = EchoStartArgsSchema.safeParse(args);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map(i => i.message).join(', ');
      console.warn('[EchoBridge] echo-start rejected: validation failed', { issues });
      return { ok: false, reason: 'validation-failed', message: issues };
    }

    const { listenerId, groupCredential, shareCredentials } = parseResult.data;

    // Clean up existing listener if any (uses safe cleanup to prevent race conditions)
    if (activeEchoListeners.has(listenerId)) {
      const existing = activeEchoListeners.get(listenerId);
      safeCleanupListener(existing);
      activeEchoListeners.delete(listenerId);
    }

    // Normalize credentials (trim whitespace for consistent handling)
    const normalizedGroupCredential = groupCredential.trim();
    const normalizedShares = shareCredentials
      .map(credential => credential.trim())
      .filter(credential => credential.length > 0);

    if (normalizedGroupCredential.length === 0) {
      return { ok: false, reason: 'invalid-group-credential', message: 'Group credential cannot be empty or whitespace-only' };
    }

    if (normalizedShares.length === 0) {
      return { ok: false, reason: 'no-valid-shares' };
    }

    try {
      const listener = await startEchoMonitor(normalizedGroupCredential, normalizedShares, (shareIndex, shareCredential, challenge) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('echo-received', {
            listenerId,
            shareIndex,
            shareCredential,
            challenge: challenge ?? null,
          });
        }
      });

      // Wrap the listener with disposed flag for race condition prevention
      const wrappedListener: EchoListener = {
        cleanup: listener.cleanup,
        disposed: false,
      };
      activeEchoListeners.set(listenerId, wrappedListener);

      event.sender.once('destroyed', () => {
        // Use safe cleanup to prevent race conditions with echo-start/echo-stop
        const existing = activeEchoListeners.get(listenerId);
        if (existing && !existing.disposed) {
          safeCleanupListener(existing);
          activeEchoListeners.delete(listenerId);
        }
      });

      return { ok: true };
    } catch (err) {
      if (!event.sender.isDestroyed()) {
        try {
          event.sender.send('echo-error', { listenerId, reason: 'start-failed', message: 'Failed to start echo listener' });
        } catch { /* ignore send error */ }
      }
      console.error('[EchoBridge] Failed to start echo listener:', { listenerId, error: sanitizeErrorForLog(err) });
      return { ok: false, reason: 'start-failed', message: 'Failed to start echo listener' };
    }
  });

  ipcMain.handle('echo-stop', async (_event: IpcMainInvokeEvent, args: unknown) => {
    // SECURITY: Validate input with Zod schema (includes length limits)
    const parseResult = EchoStopArgsSchema.safeParse(args);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map(i => i.message).join(', ');
      console.warn('[EchoBridge] echo-stop rejected: validation failed', { issues });
      return { ok: false, reason: 'validation-failed', message: issues };
    }

    const { listenerId } = parseResult.data;

    // Use safe cleanup to prevent race conditions
    const existing = activeEchoListeners.get(listenerId);
    if (existing) {
      safeCleanupListener(existing);
      activeEchoListeners.delete(listenerId);
    }

    return { ok: true };
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
