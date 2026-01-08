import { createConnectedNode } from '@frostr/igloo-core';
import type { BifrostNode } from '@frostr/bifrost';

export type KeepAliveLogLevel = 'debug' | 'info' | 'warn' | 'error';

interface KeepAliveLogger {
  (level: KeepAliveLogLevel, message: string, context?: Record<string, unknown>): void;
}

interface KeepAliveOptions {
  heartbeatMs: number;
  timeoutMs: number;
  staleMs: number;
  maxBackoffMs: number;
}

const DEFAULT_OPTIONS: KeepAliveOptions = {
  heartbeatMs: 30_000,
  timeoutMs: 5_000,
  staleMs: 30_000,
  maxBackoffMs: 30_000,
};

interface KeepAliveConfig {
  node: BifrostNode;
  groupCredential: string;
  shareCredential: string;
  relays: string[];
  selfPubkey: string;
  logger?: KeepAliveLogger;
  options?: Partial<KeepAliveOptions>;
}

interface ReplacedNodePayload {
  next: BifrostNode;
  previous: BifrostNode;
}

export interface SignerKeepAliveHandle {
  start(): void;
  stop(): void;
  onReplace(callback: (payload: ReplacedNodePayload) => void): void;
}

type CloseBridge = {
  client: { on: (event: string, handler: (...args: unknown[]) => void) => void; off?: (event: string, handler: (...args: unknown[]) => void) => void; removeListener?: (event: string, handler: (...args: unknown[]) => void) => void; };
  handler: () => void;
};

type NostrClientBridge = {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  update?: (filter: unknown) => Promise<void> | void;
  connect?: () => Promise<void> | void;
  filter?: unknown;
};

const getClientBridge = (node: BifrostNode): NostrClientBridge | null => {
  const host = (node as unknown as { client?: unknown }).client;
  if (!host || typeof host !== 'object') {
    return null;
  }
  return host as NostrClientBridge;
};

export function createSignerKeepAlive(config: KeepAliveConfig): SignerKeepAliveHandle {
  const {
    logger: rawLogger,
    options,
    groupCredential,
    shareCredential,
    relays,
    // selfPubkey available in config but not currently used
  } = config;

  const logger: KeepAliveLogger = rawLogger ?? (() => undefined);
  const resolvedOptions: KeepAliveOptions = { ...DEFAULT_OPTIONS, ...options };

  let currentNode = config.node;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let consecutiveFailures = 0;
  let lastActivityTs = Date.now();
  let replaceCallback: ((payload: ReplacedNodePayload) => void) | null = null;
  let closeBridge: CloseBridge | null = null;
  let tickInProgress = false;
  let peerCursor = 0;

  const messageListener = () => {
    lastActivityTs = Date.now();
    consecutiveFailures = 0;
  };

  const detachCloseBridge = () => {
    if (!closeBridge) return;

    const { client, handler } = closeBridge;
    let detached = false;

    if (typeof client.off === 'function') {
      try {
        client.off('close', handler);
        detached = true;
      } catch (error) {
        logger('debug', 'Failed to detach close listener via off', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (!detached && typeof client.removeListener === 'function') {
      try {
        client.removeListener('close', handler);
        detached = true;
      } catch (error) {
        logger('debug', 'Failed to detach close listener via removeListener', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (detached) {
      closeBridge = null;
    }
  };

  const attachCloseBridge = (node: BifrostNode) => {
    detachCloseBridge();
    const client = getClientBridge(node);

    if (!client || typeof client.on !== 'function') {
      logger('debug', 'No nostr client available for close bridge');
      return;
    }

    const handler = () => {
      logger('warn', 'Underlying nostr client closed, emitting node closed');
      try {
        const emitter = node as unknown as { emit?: (event: string, payload: unknown) => void };
        emitter.emit?.('closed', node);
      } catch (error) {
        logger('debug', 'Emit closed failed', { error: error instanceof Error ? error.message : String(error) });
      }
    };

    const bridgeClient: CloseBridge['client'] = {
      on: client.on.bind(client),
      off: client.off?.bind(client),
      removeListener: client.removeListener?.bind(client),
    };

    bridgeClient.on('close', handler);
    closeBridge = { client: bridgeClient, handler };
  };

  const watchNode = (node: BifrostNode) => {
    detachCloseBridge();
    const currentEmitter = currentNode as unknown as { off?: (event: string, handler: (...args: unknown[]) => void) => void };
    currentEmitter.off?.('message', messageListener);

    currentNode = node;
    lastActivityTs = Date.now();
    consecutiveFailures = 0;

    attachCloseBridge(currentNode);
    const nextEmitter = currentNode as unknown as { on?: (event: string, handler: (...args: unknown[]) => void) => void };
    nextEmitter.on?.('message', messageListener);
  };

  const cleanupNodeWatch = () => {
    detachCloseBridge();
    const emitter = currentNode as unknown as { off?: (event: string, handler: (...args: unknown[]) => void) => void };
    emitter.off?.('message', messageListener);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const attemptResubscribe = async () => {
    const client = getClientBridge(currentNode);
    if (!client || typeof client.update !== 'function') {
      throw new Error('nostr client missing update');
    }
    await Promise.resolve(client.update(client.filter));
  };

  const attemptReconnect = async () => {
    const client = getClientBridge(currentNode);
    if (!client || typeof client.connect !== 'function') {
      throw new Error('nostr client missing connect');
    }
    await Promise.resolve(client.connect());
  };

  const recreateNode = async () => {
    logger('info', 'Recreating signer node');
    const previousNode = currentNode;

    const { node: fresh } = await createConnectedNode({
      group: groupCredential,
      share: shareCredential,
      relays,
    });

    watchNode(fresh);

    if (replaceCallback) {
      replaceCallback({ next: fresh, previous: previousNode });
    }

    return fresh;
  };

  const heal = async (reason: string) => {
    logger('warn', 'Keep-alive triggered heal', { reason, failures: consecutiveFailures });
    const backoffSequence = [0, 1000, 2000, 5000, 10_000];

    for (const delay of backoffSequence) {
      if (!isRunning) return;
      if (delay) {
        await sleep(Math.min(delay, resolvedOptions.maxBackoffMs));
      }

      try {
        await attemptResubscribe();
        logger('info', 'Resubscribe succeeded');
        consecutiveFailures = 0;
        lastActivityTs = Date.now();
        return;
      } catch (error) {
        logger('debug', 'Resubscribe failed', { error: error instanceof Error ? error.message : String(error) });
      }

      try {
        await attemptReconnect();
        logger('info', 'Reconnect succeeded');
        consecutiveFailures = 0;
        lastActivityTs = Date.now();
        return;
      } catch (error) {
        logger('debug', 'Reconnect failed', { error: error instanceof Error ? error.message : String(error) });
      }

      try {
        await recreateNode();
        logger('info', 'Node recreation succeeded');
        return;
      } catch (error) {
        logger('error', 'Node recreation failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  const pickPingTarget = (): string | null => {
    try {
      const peers = (currentNode as unknown as { peers?: Array<{ pubkey: string; status?: string }> }).peers;
      if (!Array.isArray(peers) || peers.length === 0) return null;

      const online = peers.filter(p => (p?.status as string) === 'online');
      if (online.length > 0) {
        const candidate = online[peerCursor % online.length]?.pubkey;
        peerCursor = (peerCursor + 1) % Math.max(online.length, 1);
        return typeof candidate === 'string' && candidate.length > 0 ? candidate.toLowerCase() : null;
      }

      const candidate = peers[peerCursor % peers.length]?.pubkey;
      peerCursor = (peerCursor + 1) % Math.max(peers.length, 1);
      return typeof candidate === 'string' && candidate.length > 0 ? candidate.toLowerCase() : null;
    } catch {
      return null;
    }
  };

  const tick = async () => {
    if (!isRunning || tickInProgress) {
      return;
    }

    tickInProgress = true;
    const now = Date.now();
    const inactive = now - lastActivityTs > resolvedOptions.staleMs;
    let needHeal = inactive;

    const target = pickPingTarget();

    try {
      if (!target) {
        // No peers are known yet (very common at startup or in tiny clusters).
        // Previously we pinged self, which refreshed lastActivityTs and avoided
        // heal() thrashing. Emulate that explicitly:
        //  - Count this tick as healthy (not a failure)
        //  - Refresh activity to suppress the inactivity-based heal
        //  - Clear needHeal computed earlier from the stale timestamp
        logger('debug', 'Keep-alive: no peers; treating tick as healthy to avoid heal thrash');
        consecutiveFailures = 0;
        lastActivityTs = now;
        needHeal = false;
      } else {
        const pingPromise = currentNode.req.ping(target);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('heartbeat timeout')), resolvedOptions.timeoutMs);
        });

        const result = await Promise.race([pingPromise, timeoutPromise]) as { ok?: boolean; err?: unknown };
        if (!result || result.ok !== true) {
          const err = result?.err ?? 'ping failed';
          throw err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
        }
        consecutiveFailures = 0;
        lastActivityTs = Date.now();
        // Successful heartbeat observed; cancel any inactivity-driven heal for this tick.
        needHeal = false;
      }
    } catch (error) {
      // Do not mark needHeal solely on a single peer failure; rotate and rely on inactivity or failure threshold.
      consecutiveFailures += 1;
      logger('debug', 'Heartbeat failed', { error: error instanceof Error ? error.message : String(error), failures: consecutiveFailures });
    } finally {
      // Only heal if we remained inactive for this tick (needHeal true)
      // or we accumulated enough consecutive failures. When there are no
      // peers or a heartbeat succeeds, we set needHeal=false above to avoid
      // thrashing the connection with unnecessary resubscribe/reconnect cycles.
      const shouldHeal = needHeal || consecutiveFailures >= 4;
      if (shouldHeal) {
        const reason = inactive && needHeal && consecutiveFailures < 2 ? 'inactivity' : 'heartbeat failures';
        await heal(reason);
      }
      tickInProgress = false;
      if (isRunning) {
        timer = setTimeout(() => {
          void tick();
        }, resolvedOptions.heartbeatMs);
      }
    }
  };

  const start = () => {
    if (isRunning) {
      logger('debug', 'Keep-alive already running');
      return;
    }
    isRunning = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    watchNode(currentNode);
    void tick();
  };

  const stop = () => {
    if (!isRunning) {
      return;
    }
    isRunning = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    cleanupNodeWatch();
  };

  const onReplace = (callback: (payload: ReplacedNodePayload) => void) => {
    replaceCallback = callback;
  };

  return { start, stop, onReplace };
}
