import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShareManager, getAllShares } from './lib/shareManager.js';
import {
  decodeGroup,
  DEFAULT_ECHO_RELAYS,
  startListeningForAllEchoes,
} from '@frostr/igloo-core';
import { SimplePool } from 'nostr-tools';
// import type { BifrostNode } from '@frostr/igloo-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type EchoListener = { cleanup: () => void };

const activeEchoListeners = new Map<string, EchoListener>();

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

const sanitizeRelayList = (relays?: unknown): string[] => {
  if (!Array.isArray(relays)) {
    return [];
  }

  return relays
    .filter(relay => typeof relay === 'string')
    .map(relay => relay.trim())
    .filter(relay => relay.length > 0);
};

const normalizeRelay = (url: string): string => {
  const trimmed = url.trim();
  // Already a ws or wss URL — return as-is
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  // Convert http/https to ws/wss respectively
  if (/^https?:\/\//i.test(trimmed)) {
    if (/^https:\/\//i.test(trimmed)) return trimmed.replace(/^https:/i, 'wss:');
    return trimmed.replace(/^http:/i, 'ws:');
  }
  // Bare host — default to secure websocket
  return `wss://${trimmed}`;
};

// Legacy listener record removed; igloo-core manages nodes internally.

const startEchoMonitor = async (
  groupCredential: string,
  shareCredentials: string[],
  onEcho: (shareIndex: number, shareCredential: string, challenge?: string | null) => void
): Promise<EchoListener> => {
  const handledShares = new Set<string>();
  let coreListener: { cleanup: () => void; isActive?: boolean } | null = null;

  let disposed = false;

  let groupRelays: string[] = [];

  try {
    const rawGroup = decodeGroup(groupCredential) as unknown;
    const decodedGroup = (rawGroup && typeof rawGroup === 'object')
      ? (rawGroup as Record<string, unknown>)
      : {};
    const relayCandidates =
      decodedGroup?.['relays'] ??
      decodedGroup?.['relayUrls'] ??
      decodedGroup?.['relay_urls'];
    groupRelays = sanitizeRelayList(relayCandidates);
  } catch (error) {
    console.warn('[EchoBridge] Failed to decode group relay list:', error);
  }

  // Optional single-relay override for debugging / CI sync
  const envRelay = (process.env.IGLOO_TEST_RELAY ?? '').trim();
  // Normalize all candidates before comparison to avoid mismatches like
  // "example.com" vs "wss://example.com" and prevent duplicates.
  const normalizedDefaultRelays = DEFAULT_ECHO_RELAYS.map(normalizeRelay);
  const normalizedEnvRelay = envRelay ? normalizeRelay(envRelay) : null;
  if (normalizedEnvRelay && !normalizedDefaultRelays.includes(normalizedEnvRelay)) {
    normalizedDefaultRelays.push(normalizedEnvRelay);
  }
  const normalizedGroupRelays = groupRelays.map(normalizeRelay);

  const defaultSet = new Set(normalizedDefaultRelays);
  const extraRelays = normalizedGroupRelays.filter(relay => !defaultSet.has(relay));
  // Combined set if needed in the future; not required for the two-listener strategy.

  const notifyEcho = (shareIndex: number, shareCredential: string, challenge?: string | null) => {
    const key = `${shareIndex}:${shareCredential}:${challenge ?? ''}`;
    if (handledShares.has(key)) {
      return;
    }

    handledShares.add(key);
    onEcho(shareIndex, shareCredential, challenge ?? undefined);
  };

  // Parser to support new and old igloo-core callback signatures.
  // New form may pass an object or include a challenge; old form is (index, shareCredential).
  const handleCoreCallback = (arg1: any, arg2?: any, arg3?: any) => {
    try {
      // Case 1: (subsetIndex: number, shareCredential: string, details?: { challenge?: string })
      if (typeof arg1 === 'number' && typeof arg2 === 'string') {
        const subsetIndex = arg1 as number;
        const shareCredential = arg2 as string;
        const challenge = typeof arg3 === 'string'
          ? (arg3 as string)
          : (arg3 && typeof arg3 === 'object' && typeof arg3.challenge === 'string')
            ? arg3.challenge
            : undefined;
        notifyEcho(subsetIndex, shareCredential, challenge);
        return;
      }

      // Case 2: (payload: { shareIndex, shareCredential, challenge? })
      if (arg1 && typeof arg1 === 'object' && typeof arg1.shareIndex === 'number' && typeof arg1.shareCredential === 'string') {
        notifyEcho(arg1.shareIndex, arg1.shareCredential, typeof arg1.challenge === 'string' ? arg1.challenge : undefined);
        return;
      }

      // Unknown form; try best-effort
      if (typeof arg1 === 'number') {
        notifyEcho(arg1, String(arg2 ?? '')); // fallback
        return;
      }
    } catch (err) {
      console.warn('[EchoBridge] Failed to parse echo callback payload', { err });
    }
  };

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

  const defaultListener = startListeningForAllEchoes(
    groupCredential,
    shareCredentials,
    (subsetIndex: number, shareCredential: string, details?: unknown) => {
      if (disposed) return;
      handleCoreCallback(subsetIndex, shareCredential, details);
    },
    {
      relays: normalizedDefaultRelays,
      eventConfig: { enableLogging: debugEnabled, customLogger: debugLogger }
    }
  );
  listeners.push(defaultListener);

  if (extraRelays.length > 0) {
    const groupListener = startListeningForAllEchoes(
      groupCredential,
      shareCredentials,
      (subsetIndex: number, shareCredential: string, details?: unknown) => {
        if (disposed) return;
        handleCoreCallback(subsetIndex, shareCredential, details);
      },
      {
        relays: extraRelays,
        eventConfig: { enableLogging: debugEnabled, customLogger: debugLogger }
      }
    );
    listeners.push(groupListener);
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
      nodeIntegration: true,
      contextIsolation: false
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
}

app.whenReady().then(() => {
  createWindow();
  
  // Initialize share manager
  const shareManager = new ShareManager();
  
  // Set up IPC handlers for share operations
  ipcMain.handle('get-shares', async () => {
    return getAllShares();
  });
  
  ipcMain.handle('save-share', async (_event: IpcMainInvokeEvent, share: Parameters<ShareManager['saveShare']>[0]) => {
    try {
      if (!share || typeof share !== 'object') {
        console.warn('[ShareManager] save-share rejected: invalid payload type');
        return false;
      }
      const s = (share as unknown) as Record<string, unknown>;
      const required = {
        id: s.id,
        name: s.name,
        share: s.share,
        salt: s.salt,
        groupCredential: s.groupCredential,
      } as Record<string, unknown>;
      for (const [key, value] of Object.entries(required)) {
        if (typeof value !== 'string' || value.trim().length === 0) {
          console.warn('[ShareManager] save-share rejected: missing/invalid field', { field: key });
          return false;
        }
      }
      return shareManager.saveShare(share);
    } catch (err) {
      console.error('[ShareManager] save-share failed:', err);
      return false;
    }
  });
  
  ipcMain.handle('delete-share', async (_event: IpcMainInvokeEvent, shareId: string) => {
    try {
      if (typeof shareId !== 'string' || shareId.trim().length === 0) {
        console.warn('[ShareManager] delete-share rejected: invalid shareId');
        return false;
      }
      return shareManager.deleteShare(shareId.trim());
    } catch (err) {
      console.error('[ShareManager] delete-share failed:', err);
      return false;
    }
  });

  ipcMain.handle('open-share-location', async (_event: IpcMainInvokeEvent, shareId: string) => {
    try {
      const filePath = shareManager.getSharePath(shareId);
      await shell.showItemInFolder(filePath);
      return { ok: true };
    } catch (error) {
      console.error('Failed to open share location:', error);
      return { ok: false };
    }
  });

  type EchoStartArgs = {
    listenerId?: unknown;
    groupCredential?: unknown;
    shareCredentials?: unknown;
  };

  ipcMain.handle('echo-start', async (event: IpcMainInvokeEvent, args: EchoStartArgs) => {
    const { listenerId, groupCredential, shareCredentials } = args ?? {};

    if (typeof listenerId !== 'string' || listenerId.trim().length === 0) {
      return { ok: false, reason: 'invalid-listener-id' };
    }

    if (typeof groupCredential !== 'string' || groupCredential.trim().length === 0) {
      return { ok: false, reason: 'invalid-group' };
    }

    if (activeEchoListeners.has(listenerId)) {
      const existing = activeEchoListeners.get(listenerId);
      try {
        existing?.cleanup?.();
      } catch (err) {
        console.warn('[EchoBridge] Failed to cleanup existing listener during start', { listenerId, err });
      } finally {
        activeEchoListeners.delete(listenerId);
      }
    }

    const normalizedShares = Array.isArray(shareCredentials)
      ? (shareCredentials
          .filter((credential): credential is string => typeof credential === 'string')
          .map(credential => credential.trim())
          .filter(credential => credential.length > 0))
      : [];

    if (normalizedShares.length === 0) {
      return { ok: false, reason: 'no-valid-shares' };
    }

    try {
      const listener = await startEchoMonitor(groupCredential, normalizedShares, (shareIndex, shareCredential, challenge) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('echo-received', {
            listenerId,
            shareIndex,
            shareCredential,
            challenge: challenge ?? null,
          });
        }
      });

      activeEchoListeners.set(listenerId, listener);

      event.sender.once('destroyed', () => {
        if (activeEchoListeners.has(listenerId)) {
          const existing = activeEchoListeners.get(listenerId);
          try {
            existing?.cleanup?.();
          } catch (err) {
            console.warn('[EchoBridge] Listener cleanup failed on sender destroyed', { listenerId, err });
          } finally {
            activeEchoListeners.delete(listenerId);
          }
        }
      });

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!event.sender.isDestroyed()) {
        try {
          event.sender.send('echo-error', { listenerId, reason: 'start-failed', message });
        } catch { /* ignore send error */ }
      }
      console.error('[EchoBridge] Failed to start echo listener:', { listenerId, error: err });
      return { ok: false, reason: 'start-failed', message };
    }
  });

  type EchoStopArgs = { listenerId?: unknown };

  ipcMain.handle('echo-stop', async (_event: IpcMainInvokeEvent, args: EchoStopArgs) => {
    const { listenerId } = args ?? {};

    if (typeof listenerId !== 'string' || listenerId.trim().length === 0) {
      return { ok: false, reason: 'invalid-listener-id' };
    }

    const existing = activeEchoListeners.get(listenerId);
    if (existing) {
      try {
        existing.cleanup?.();
      } catch (err) {
        console.warn('[EchoBridge] Listener cleanup failed on stop', { listenerId, err });
      } finally {
        activeEchoListeners.delete(listenerId);
      }
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
