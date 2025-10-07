import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShareManager, getAllShares } from './lib/shareManager.js';
import {
  decodeGroup,
  createBifrostNode,
  connectNode,
  closeNode,
  DEFAULT_ECHO_RELAYS,
} from '@frostr/igloo-core';
import { SimplePool } from 'nostr-tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeEchoListeners = new Map();

try {
  const poolProto: any = SimplePool?.prototype;
  if (poolProto && !poolProto.__iglooFilterNormalizePatched) {
    const originalSubscribeMany = poolProto.subscribeMany;
    if (typeof originalSubscribeMany === 'function') {
      poolProto.subscribeMany = function patchedSubscribeMany(this: any, relays: any, filters: any, params: any) {
        let normalizedFilters = filters;

        if (Array.isArray(filters)) {
          if (filters.length === 1) {
            const first = filters[0];
            if (Array.isArray(first)) {
              normalizedFilters = first;
            } else if (first && typeof first === 'object') {
              normalizedFilters = first;
            }
          } else {
            normalizedFilters = filters.map(item => (
              Array.isArray(item) && item.length === 1 && item[0] && typeof item[0] === 'object'
                ? item[0]
                : item
            ));
          }
        }

        return originalSubscribeMany.call(this, relays, normalizedFilters, params);
      };

      Object.defineProperty(poolProto, '__iglooFilterNormalizePatched', {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }
  }
} catch (error) {
  console.warn('[EchoBridge] Failed to normalize nostr subscribe filters:', error);
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

const startEchoMonitor = (
  groupCredential: string,
  shareCredentials: string[],
  onEcho: (shareIndex: number, shareCredential: string) => void
) => {
  const handledShares = new Set<string>();
  const listenerRecords: Array<{
    node: unknown;
    handlers: Array<{ event: string; handler: (...args: unknown[]) => void }>;
  }> = [];

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
  const hasCustomRelays = extraRelays.length > 0;

  const attachListener = (node: any, event: string, handler: (...args: unknown[]) => void) => {
    if (typeof node?.on === 'function') {
      node.on(event, handler);
    }
  };

  const detachListener = (node: any, event: string, handler: (...args: unknown[]) => void) => {
    if (typeof node?.off === 'function') {
      node.off(event, handler);
    } else if (typeof node?.removeListener === 'function') {
      node.removeListener(event, handler);
    }
  };

  const cleanupRecord = (record: { node: any; handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> }) => {
    const { node, handlers } = record;
    handlers.forEach(({ event, handler }) => {
      detachListener(node, event, handler);
    });

    try {
      closeNode(node);
    } catch (error) {
      console.warn('[EchoBridge] Error during echo listener cleanup:', error);
    }
  };

  const notifyEcho = (shareIndex: number, shareCredential: string) => {
    const key = `${shareIndex}:${shareCredential}`;
    if (handledShares.has(key)) {
      return;
    }

    handledShares.add(key);
    onEcho(shareIndex, shareCredential);
  };

  const createRecord = (
    shareCredential: string,
    shareIndex: number,
    relays: string[]
  ): { node: any; handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> } => {
    const node = createBifrostNode(
      { group: groupCredential, share: shareCredential, relays },
      { enableLogging: false }
    );

    const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

    const register = (event: string, handler: (...args: unknown[]) => void) => {
      handlers.push({ event, handler });
      attachListener(node, event, handler);
    };

    const messageHandler = (payload: any) => {
      const tag = payload?.tag;
      if (tag === '/echo/req' || tag === '/echo/res' || tag === '/echo/handler/req') {
        notifyEcho(shareIndex, shareCredential);
      }
    };

    const responseHandler = () => {
      notifyEcho(shareIndex, shareCredential);
    };

    const errorHandler = (error: unknown) => {
      console.error(`[EchoBridge] Listener error for share index ${shareIndex}:`, error);
    };

    const closedHandler = () => {
      console.info(`[EchoBridge] Listener connection closed for share index ${shareIndex}`);
    };

    register('message', messageHandler);
    register('/echo/handler/req', responseHandler);
    register('/echo/handler/res', responseHandler);
    register('/echo/handler/ret', responseHandler);
    register('/echo/sender/res', responseHandler);
    register('error', errorHandler);
    register('closed', closedHandler);

    return { node, handlers };
  };

  const attemptConnection = async (
    shareCredential: string,
    shareIndex: number,
    relays: string[],
    allowFallback: boolean
  ) => {
    let record: { node: any; handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> } | null = null;

    try {
      console.debug(
        `[EchoBridge] Connecting listener for share index ${shareIndex} using relays: ${relays.join(', ')}`
      );

      record = createRecord(shareCredential, shareIndex, relays);
      await connectNode(record.node);
      console.info(
        `[EchoBridge] Echo listener ready for share index ${shareIndex} on relays: ${relays.join(', ')}`
      );
      listenerRecords.push(record);
    } catch (error: any) {
      if (record) {
        cleanupRecord(record);
      }

      const underlying = error?.details?.error ?? error;

      if (allowFallback) {
        console.warn(
          `[EchoBridge] Primary relay set failed for share index ${shareIndex}. Falling back to defaults.`,
          underlying
        );
        await attemptConnection(shareCredential, shareIndex, defaultRelays, false);
      } else {
        console.error(
          `[EchoBridge] Failed to establish echo listener for share index ${shareIndex}:`,
          underlying
        );
      }
    }
  };

  shareCredentials.forEach((shareCredential, shareIndex) => {
    void attemptConnection(
      shareCredential,
      shareIndex,
      primaryRelays,
      hasCustomRelays
    ).catch(error => {
      console.error(`[EchoBridge] Unexpected error while connecting listener for share index ${shareIndex}:`, error);
    });
  });

  return {
    cleanup: () => {
      listenerRecords.splice(0).forEach(record => {
        cleanupRecord(record);
      });
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
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('save-share', async (_: any, share: any) => {
    return shareManager.saveShare(share);
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('delete-share', async (_: any, shareId: string) => {
    return shareManager.deleteShare(shareId);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('open-share-location', async (_: any, shareId: string) => {
    const filePath = shareManager.getSharePath(shareId);
    await shell.showItemInFolder(filePath);
  });

  ipcMain.handle('echo-start', async (event: IpcMainInvokeEvent, args: any) => {
    const { listenerId, groupCredential, shareCredentials } = args ?? {};

    if (typeof listenerId !== 'string' || listenerId.trim().length === 0) {
      return { ok: false, reason: 'invalid-listener-id' };
    }

    if (activeEchoListeners.has(listenerId)) {
      const existing = activeEchoListeners.get(listenerId);
      existing?.cleanup?.();
      activeEchoListeners.delete(listenerId);
    }

    const normalizedShares = Array.isArray(shareCredentials)
      ? shareCredentials
          .filter((credential: unknown): credential is string => typeof credential === 'string')
          .map(credential => credential.trim())
          .filter(credential => credential.length > 0)
      : [];

    if (normalizedShares.length === 0) {
      return { ok: false, reason: 'no-valid-shares' };
    }

    const listener = startEchoMonitor(groupCredential, normalizedShares, (shareIndex, shareCredential) => {
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

  ipcMain.handle('echo-stop', async (_event: IpcMainInvokeEvent, args: any) => {
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
