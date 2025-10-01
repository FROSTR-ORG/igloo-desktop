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
    selfPubkey,
  } = config;

  const logger: KeepAliveLogger = rawLogger ?? (() => undefined);
  const resolvedOptions: KeepAliveOptions = { ...DEFAULT_OPTIONS, ...options };

  let currentNode = config.node;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let consecutiveFailures = 0;
  let lastActivityTs = Date.now();
  let replaceCallback: ((payload: ReplacedNodePayload) => void) | null = null;
  let closeBridge: CloseBridge | null = null;

  const messageListener = () => {
    lastActivityTs = Date.now();
    consecutiveFailures = 0;
  };

  const detachCloseBridge = () => {
    if (!closeBridge) return;

    const { client, handler } = closeBridge;
    try {
      if (typeof client.off === 'function') {
        client.off('close', handler);
      } else if (typeof client.removeListener === 'function') {
        client.removeListener('close', handler);
      }
    } catch (error) {
      logger('debug', 'Failed to detach close bridge', { error: error instanceof Error ? error.message : String(error) });
    }

    closeBridge = null;
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
      if (stopped) return;
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

  const tick = async () => {
    if (stopped) {
      return;
    }

    const now = Date.now();
    const inactive = now - lastActivityTs > resolvedOptions.staleMs;

    try {
      const pingPromise = currentNode.req.ping(selfPubkey);
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
    } catch (error) {
      consecutiveFailures += 1;
      logger('debug', 'Heartbeat failed', { error: error instanceof Error ? error.message : String(error), failures: consecutiveFailures });
    }

    if (inactive || consecutiveFailures >= 2) {
      await heal(inactive ? 'inactivity' : 'heartbeat failures');
    }

    if (!stopped) {
      timer = setTimeout(() => {
        void tick();
      }, resolvedOptions.heartbeatMs);
    }
  };

  const start = () => {
    if (stopped) {
      logger('debug', 'Keep-alive already stopped, skipping start');
      return;
    }
    watchNode(currentNode);
    void tick();
  };

  const stop = () => {
    stopped = true;
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
