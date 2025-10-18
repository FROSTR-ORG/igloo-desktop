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
    const original = poolProto.subscribeMany as (relays: unknown, filter: unknown, params: unknown) => any;
    if (typeof original === 'function') {
      poolProto.subscribeMany = function patchedSubscribeMany(this: any, relays: unknown, filter: unknown, params: unknown) {
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

const SHOULD_THROW_ON_MISSING_LISTENER = process.env.SHOULD_THROW_ON_MISSING_LISTENER === 'true';

const sanitizeRelayList = (relays?: unknown): string[] => {
  if (!Array.isArray(relays)) {
    return [];
  }

  return relays
    .filter(relay => typeof relay === 'string')
    .map(relay => relay.trim())
    .filter(relay => relay.length > 0);
};

type EventHandler = (...args: unknown[]) => void;

// Legacy listener record removed; igloo-core manages nodes internally.

const startEchoMonitor = async (
  groupCredential: string,
  shareCredentials: string[],
  onEcho: (shareIndex: number, shareCredential: string) => void
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

  const defaultRelays = DEFAULT_ECHO_RELAYS.slice();
  const extraRelays = groupRelays.filter(relay => !defaultRelays.includes(relay));
  const primaryRelays = Array.from(new Set([...defaultRelays, ...extraRelays]));

  const notifyEcho = (shareIndex: number, shareCredential: string) => {
    const key = `${shareIndex}:${shareCredential}`;
    if (handledShares.has(key)) {
      return;
    }

    handledShares.add(key);
    onEcho(shareIndex, shareCredential);
  };

  // Start two listeners to avoid connect-all-or-fail on a combined set:
  // - one on the stable defaults
  // - one on the group's extra relays (if any)
  const listeners: Array<{ cleanup: () => void }> = [];

  const defaultListener = startListeningForAllEchoes(
    groupCredential,
    shareCredentials,
    (shareIndex, shareCredential) => {
      if (disposed) return;
      notifyEcho(shareIndex, shareCredential);
    },
    {
      relays: defaultRelays,
      eventConfig: { enableLogging: false }
    }
  );
  listeners.push(defaultListener);

  if (extraRelays.length > 0) {
    const groupListener = startListeningForAllEchoes(
      groupCredential,
      shareCredentials,
      (shareIndex, shareCredential) => {
        if (disposed) return;
        notifyEcho(shareIndex, shareCredential);
      },
      {
        relays: extraRelays,
        eventConfig: { enableLogging: false }
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
    return shareManager.saveShare(share);
  });
  
  ipcMain.handle('delete-share', async (_event: IpcMainInvokeEvent, shareId: string) => {
    return shareManager.deleteShare(shareId);
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
      existing?.cleanup?.();
      activeEchoListeners.delete(listenerId);
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

    const listener = await startEchoMonitor(groupCredential, normalizedShares, (shareIndex, shareCredential) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('echo-received', {
          listenerId,
          shareIndex,
          shareCredential
        });
      }
    });

    activeEchoListeners.set(listenerId, listener);

    event.sender.once('destroyed', () => {
      if (activeEchoListeners.has(listenerId)) {
        const existing = activeEchoListeners.get(listenerId);
        existing?.cleanup?.();
        activeEchoListeners.delete(listenerId);
      }
    });

    return { ok: true };
  });

  type EchoStopArgs = { listenerId?: unknown };

  ipcMain.handle('echo-stop', async (_event: IpcMainInvokeEvent, args: EchoStopArgs) => {
    const { listenerId } = args ?? {};

    if (typeof listenerId !== 'string' || listenerId.trim().length === 0) {
      return { ok: false, reason: 'invalid-listener-id' };
    }

    const existing = activeEchoListeners.get(listenerId);
    if (existing) {
      existing.cleanup?.();
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
