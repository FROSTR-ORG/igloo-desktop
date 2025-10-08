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
import type { BifrostNode } from '@frostr/igloo-core';
import { SimplePool } from 'nostr-tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type EchoListener = { cleanup: () => void };

const activeEchoListeners = new Map<string, EchoListener>();

type SubscribeManyFn = (...args: unknown[]) => unknown;
type SimplePoolPrototype = typeof SimplePool.prototype & {
  __iglooFilterNormalizePatched?: boolean;
  subscribeMany?: SubscribeManyFn;
};

try {
  const poolProto = SimplePool?.prototype as SimplePoolPrototype | undefined;
  if (poolProto && !poolProto.__iglooFilterNormalizePatched) {
    const originalSubscribeMany = poolProto.subscribeMany as SubscribeManyFn | undefined;
    if (typeof originalSubscribeMany === 'function') {
      const patchedSubscribeMany: SubscribeManyFn = function patchedSubscribeMany(this: SimplePoolPrototype, relays: unknown, filters: unknown, params: unknown) {
        let normalizedFilters = filters;

        if (Array.isArray(filters)) {
          if (filters.length === 1) {
            const first = filters[0];
            normalizedFilters = Array.isArray(first) ? first : filters;
          } else {
            normalizedFilters = filters.reduce<unknown[]>((acc, item) => {
              if (Array.isArray(item)) {
                if (item.length > 1) {
                  acc.push(...item);
                } else {
                  acc.push(item);
                }
              } else {
                acc.push(item);
              }
              return acc;
            }, []);
          }
        }

        return originalSubscribeMany.call(this, relays, normalizedFilters, params);
      };

      poolProto.subscribeMany = patchedSubscribeMany as typeof poolProto.subscribeMany;

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

type ListenerRecord = {
  node: BifrostNode;
  handlers: Array<{ event: string; handler: EventHandler }>;
};

const startEchoMonitor = (
  groupCredential: string,
  shareCredentials: string[],
  onEcho: (shareIndex: number, shareCredential: string) => void
): EchoListener => {
  const handledShares = new Set<string>();
  const listenerRecords: ListenerRecord[] = [];
  
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
  const hasCustomRelays = extraRelays.length > 0;

  type EventfulNode = {
    on?: (event: string, handler: EventHandler) => unknown;
    off?: (event: string, handler: EventHandler) => unknown;
    removeListener?: (event: string, handler: EventHandler) => unknown;
  };

  const attachListener = (node: BifrostNode, event: string, handler: EventHandler) => {
    const emitter = node as unknown as EventfulNode;
    if (typeof emitter.on === 'function') {
      emitter.on(event, handler);
      return;
    }
    const nodeType = 'BifrostNode';
    const handlerName = handler.name || 'anonymous';
    console.warn(`[EchoBridge] attachListener: Missing 'on' method on ${nodeType} for event '${event}' and handler '${handlerName}'`);
    if (SHOULD_THROW_ON_MISSING_LISTENER) {
      throw new Error(`Critical: Missing 'on' method on ${nodeType} for event '${event}'`);
    }
  };

  const detachListener = (node: BifrostNode, event: string, handler: EventHandler) => {
    const emitter = node as unknown as EventfulNode;
    if (typeof emitter.off === 'function') {
      emitter.off(event, handler);
      return;
    } else if (typeof emitter.removeListener === 'function') {
      emitter.removeListener(event, handler);
      return;
    }
    const nodeType = 'BifrostNode';
    const handlerName = handler.name || 'anonymous';
    console.warn(`[EchoBridge] detachListener: Missing 'off' and 'removeListener' methods on ${nodeType} for event '${event}' and handler '${handlerName}'`);
    if (SHOULD_THROW_ON_MISSING_LISTENER) {
      throw new Error(`Critical: Missing listener detachment methods on ${nodeType} for event '${event}'`);
    }
  };

  const cleanupRecord = (record: ListenerRecord) => {
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
  ): ListenerRecord => {
    const node = createBifrostNode(
      { group: groupCredential, share: shareCredential, relays },
      { enableLogging: false }
    );

    const handlers: Array<{ event: string; handler: EventHandler }> = [];

    const register = (event: string, handler: EventHandler) => {
      handlers.push({ event, handler });
      attachListener(node, event, handler);
    };

    const messageHandler = (payload: unknown) => {
      const tag = (payload as { tag?: unknown })?.tag;
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
    if (disposed) {
      return;
    }

    let record: ListenerRecord | null = null;

    try {
      console.debug(
        `[EchoBridge] Connecting listener for share index ${shareIndex} using relays: ${relays.join(', ')}`
      );

      record = createRecord(shareCredential, shareIndex, relays);

      if (disposed) {
        cleanupRecord(record);
        return;
      }

      await connectNode(record.node);

      if (disposed) {
        cleanupRecord(record);
        return;
      }

      console.info(
        `[EchoBridge] Echo listener ready for share index ${shareIndex} on relays: ${relays.join(', ')}`
      );
      listenerRecords.push(record);
    } catch (error: unknown) {
      if (record) {
        cleanupRecord(record);
      }

      const underlying =
        typeof error === 'object' && error !== null && 'details' in error
          ? (error as { details?: { error?: unknown } }).details?.error ?? error
          : error;

      if (allowFallback && !disposed) {
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
      disposed = true;
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
