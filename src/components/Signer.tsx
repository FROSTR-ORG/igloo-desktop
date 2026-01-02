import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Tooltip } from "@/components/ui/tooltip"
import {
  createConnectedNode,
  validateShare,
  validateGroup,
  decodeShare,
  decodeGroup,
  cleanupBifrostNode,
  extractSelfPubkeyFromCredentials,
  setNodePolicies,
  normalizePubkey
} from "@frostr/igloo-core"
import { Copy, Check, X, HelpCircle, ChevronDown, ChevronRight, User } from "lucide-react"
import { QRCodeSVG } from 'qrcode.react'
import type { SignatureEntry, ECDHPackage, SignSessionPackage, BifrostNode } from '@frostr/bifrost'
import { EventLog, type LogEntryData } from "./EventLog"
import { Input } from "@/components/ui/input"
import PeerList from "@/components/ui/peer-list"
import { createSignerKeepAlive, type SignerKeepAliveHandle } from '@/lib/signer-keepalive';
import { clientShareManager } from '@/lib/clientShareManager';
import type {
  SignerHandle,
  SignerProps,
  SharePolicy,
  SharePolicyEntry,
  IglooShare
} from '@/types';

// Add CSS for the pulse animation
const pulseStyle = `
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .pulse-animation {
    animation: pulse 1.5s ease-in-out infinite;
    box-shadow: 0 0 5px 2px rgba(34, 197, 94, 0.6);
  }
`;

// Event mapping for cleaner message handling
const EVENT_MAPPINGS = {
  '/sign/req': { type: 'sign', message: 'Signature request received' },
  '/sign/res': { type: 'sign', message: 'Signature response sent' },
  '/sign/rej': { type: 'sign', message: 'Signature request rejected' },
  '/sign/ret': { type: 'sign', message: 'Signature shares aggregated' },
  '/sign/err': { type: 'sign', message: 'Signature share aggregation failed' },
  '/ecdh/req': { type: 'ecdh', message: 'ECDH request received' },
  '/ecdh/res': { type: 'ecdh', message: 'ECDH response sent' },
  '/ecdh/rej': { type: 'ecdh', message: 'ECDH request rejected' },
  '/ecdh/ret': { type: 'ecdh', message: 'ECDH shares aggregated' },
  '/ecdh/err': { type: 'ecdh', message: 'ECDH share aggregation failed' },
  '/ping/req': { type: 'bifrost', message: 'Ping request' },
  '/ping/res': { type: 'bifrost', message: 'Ping response' },
} as const;

const DEFAULT_RELAY = "wss://relay.primal.net";

const DEFAULT_POLICY_ENTRY: SharePolicyEntry = {
  allowSend: true,
  allowReceive: true
};

const safeNormalizePubkey = (pubkey: string): string => {
  if (!pubkey || typeof pubkey !== 'string') {
    return '';
  }

  try {
    const normalized = normalizePubkey(pubkey);
    if (typeof normalized === 'string' && normalized.length > 0) {
      return normalized.toLowerCase();
    }
  } catch {
    // Swallow normalization errors and fall back to lowercase pubkey
  }

  return pubkey.toLowerCase();
};

const ensurePolicyEntry = (entry?: SharePolicyEntry): SharePolicyEntry => ({
  allowSend: entry?.allowSend ?? DEFAULT_POLICY_ENTRY.allowSend,
  allowReceive: entry?.allowReceive ?? DEFAULT_POLICY_ENTRY.allowReceive,
  ...(entry?.updatedAt ? { updatedAt: entry.updatedAt } : {})
});

const normalizeSharePolicy = (policy?: SharePolicy): SharePolicy => {
  const defaults = ensurePolicyEntry(policy?.defaults);
  const peers = policy?.peers
    ? Object.entries(policy.peers).reduce<Record<string, SharePolicyEntry>>((acc, [key, value]) => {
        const normalizedKey = safeNormalizePubkey(key);
        acc[normalizedKey] = ensurePolicyEntry(value);
        return acc;
      }, {})
    : {};

  const normalized: SharePolicy = {
    defaults,
    updatedAt: policy?.updatedAt
  };

  if (Object.keys(peers).length > 0) {
    normalized.peers = peers;
  }

  return normalized;
};

const policyEntriesToArray = (policy: SharePolicy): Array<{
  pubkey: string;
  allowSend: boolean;
  allowReceive: boolean;
}> => {
  if (!policy.peers) {
    return [];
  }

  return Object.entries(policy.peers).map(([pubkey, entry]) => ({
    pubkey,
    allowSend: entry.allowSend,
    allowReceive: entry.allowReceive
  }));
};

const stampPolicyUpdate = () => new Date().toISOString();

const updatePolicyEntryForPeer = (
  policy: SharePolicy,
  pubkey: string,
  allowSend: boolean,
  allowReceive: boolean
): { next: SharePolicy; changed: boolean } => {
  const key = safeNormalizePubkey(pubkey);
  const defaults = ensurePolicyEntry(policy.defaults);
  const peers = policy.peers ? { ...policy.peers } : {};
  const current = peers[key];
  const currentAllowSend = current?.allowSend ?? defaults.allowSend;
  const currentAllowReceive = current?.allowReceive ?? defaults.allowReceive;

  if (currentAllowSend === allowSend && currentAllowReceive === allowReceive) {
    return { next: policy, changed: false };
  }

  const timestamp = stampPolicyUpdate();

  if (allowSend === defaults.allowSend && allowReceive === defaults.allowReceive) {
    if (!current) {
      return { next: policy, changed: false };
    }

    delete peers[key];
    const remainingKeys = Object.keys(peers);
    const nextPolicy: SharePolicy = {
      defaults,
      updatedAt: timestamp
    };

    if (remainingKeys.length > 0) {
      nextPolicy.peers = peers;
    }

    return { next: nextPolicy, changed: true };
  }

  peers[key] = {
    allowSend,
    allowReceive,
    updatedAt: timestamp
  };

  const nextPolicy: SharePolicy = {
    defaults,
    peers,
    updatedAt: timestamp
  };

  return { next: nextPolicy, changed: true };
};

// Helper function to extract share information
const getShareInfo = (groupCredential: string, shareCredential: string, shareName?: string) => {
  try {
    if (!groupCredential || !shareCredential) return null;

    const decodedGroup = decodeGroup(groupCredential);
    const decodedShare = decodeShare(shareCredential);

    // Find the corresponding commit in the group
    const commit = decodedGroup.commits.find(c => c.idx === decodedShare.idx);

    if (commit) {
      return {
        index: decodedShare.idx,
        pubkey: commit.pubkey,
        shareName: shareName || `Share ${decodedShare.idx}`,
        threshold: decodedGroup.threshold,
        totalShares: decodedGroup.commits.length
      };
    }

    return null;
  } catch {
    return null;
  }
};

const Signer = forwardRef<SignerHandle, SignerProps>(({ initialData }, ref) => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [signerSecret, setSignerSecret] = useState(initialData?.decryptedShare || "");
  const [isShareValid, setIsShareValid] = useState(false);
  const [relayUrls, setRelayUrls] = useState<string[]>([DEFAULT_RELAY]);
  const [newRelayUrl, setNewRelayUrl] = useState("");

  const [groupCredential, setGroupCredential] = useState(initialData?.groupCredential || "");
  const [isGroupValid, setIsGroupValid] = useState(false);

  const [shareRecord, setShareRecord] = useState<IglooShare | null>(initialData?.shareRecord ?? null);
  const [sharePolicy, setSharePolicy] = useState<SharePolicy>(() => normalizeSharePolicy(initialData?.shareRecord?.policy));
  const sharePolicyRef = useRef<SharePolicy>(normalizeSharePolicy(initialData?.shareRecord?.policy));

  const [copiedStates, setCopiedStates] = useState({
    group: false,
    share: false
  });
  const [expandedItems, setExpandedItems] = useState<Record<'group' | 'share', boolean>>({
    group: false,
    share: false
  });
  const [logs, setLogs] = useState<LogEntryData[]>([]);

  const nodeRef = useRef<BifrostNode | null>(null);
  // Track cleanup functions for event listeners to prevent memory leaks
  const cleanupListenersRef = useRef<(() => void)[]>([]);
  const keepAliveRef = useRef<SignerKeepAliveHandle | null>(null);
  const isSignerRunningRef = useRef(false);

  const updateSignerRunning = useCallback((running: boolean) => {
    isSignerRunningRef.current = running;
    setIsSignerRunning(running);
  }, []);

  // Expose the stopSigner method to parent components through ref
  useImperativeHandle(ref, () => ({
    stopSigner: async () => {
      console.log('External stopSigner method called');
      if (isSignerRunning) {
        await handleStopSigner();
      }
    }
  }));

  // Helper function to safely detect duplicate log entries
  const isDuplicateLog = (newData: unknown, recentLogs: LogEntryData[]): boolean => {
    if (!newData || typeof newData !== 'object') {
      return false;
    }

    // Fast path: check for duplicate IDs and tags without serialization
    if ('id' in newData && 'tag' in newData && newData.id && newData.tag) {
      return recentLogs.some(log =>
        log.data &&
        typeof log.data === 'object' &&
        'id' in log.data &&
        'tag' in log.data &&
        log.data.id === newData.id &&
        log.data.tag === newData.tag
      );
    }

    // Fallback: safe serialization comparison for complex objects
    try {
      const newDataString = JSON.stringify(newData);
      return recentLogs.some(log => {
        if (!log.data) return false;

        try {
          const logDataString = typeof log.data === 'string'
            ? log.data
            : JSON.stringify(log.data);
          return logDataString === newDataString;
        } catch {
          // If serialization fails, assume not duplicate to avoid false positives
          return false;
        }
      });
    } catch {
      // If initial serialization fails (circular refs, etc.), skip duplicate check
      return false;
    }
  };

  const addLog = useCallback((type: string, message: string, data?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substr(2, 9);

    setLogs(prev => {
      // Only check for duplicates if we have data to compare
      if (data) {
        const recentLogs = prev.slice(-5); // Check last 5 entries for performance
        if (isDuplicateLog(data, recentLogs)) {
          return prev; // Skip adding duplicate
        }
      }

      return [...prev, { timestamp, type, message, data, id }];
    });
  }, []);

  // Extracted event handling functions with cleanup capabilities
  const setupBasicEventListeners = useCallback((node: BifrostNode) => {
    const closedHandler = () => {
      addLog('bifrost', 'Bifrost node is closed');
      updateSignerRunning(false);
      setIsConnecting(false);
    };

    const errorHandler = (error: unknown) => {
      addLog('error', 'Node error', error);
      updateSignerRunning(false);
      setIsConnecting(false);
    };

    const readyHandler = (data: unknown) => {
      // Log basic info about the ready event without the potentially problematic data object
      const logData = data && typeof data === 'object' ?
        { message: 'Node ready event received', hasData: true, dataType: typeof data } :
        data;
      addLog('ready', 'Node is ready', logData);
      setIsConnecting(false);
      updateSignerRunning(true);
    };

    const bouncedHandler = (reason: string, msg: unknown) =>
      addLog('bifrost', `Message bounced: ${reason}`, msg);

    // Add event listeners
    node.on('closed', closedHandler);
    node.on('error', errorHandler);
    node.on('ready', readyHandler);
    node.on('bounced', bouncedHandler);

    // Return cleanup function
    return () => {
      try {
        node.off('closed', closedHandler);
        node.off('error', errorHandler);
        node.off('ready', readyHandler);
        node.off('bounced', bouncedHandler);
      } catch (error) {
        console.warn('Error removing basic event listeners:', error);
      }
    };
  }, [addLog, updateSignerRunning, setIsConnecting]);

  const setupMessageEventListener = useCallback((node: BifrostNode) => {
    const messageHandler = (msg: unknown) => {
      try {
        if (msg && typeof msg === 'object' && 'tag' in msg) {
          const messageData = msg as { tag: unknown;[key: string]: unknown };
          const tag = messageData.tag;

          // Ensure tag is a string before calling string methods
          if (typeof tag !== 'string') {
            addLog('bifrost', 'Message received (invalid tag type)', {
              tagType: typeof tag,
              tag,
              originalMessage: msg
            });
            return;
          }

          // Use the event mapping for cleaner code
          const eventInfo = EVENT_MAPPINGS[tag as keyof typeof EVENT_MAPPINGS];
          if (eventInfo) {
            addLog(eventInfo.type, eventInfo.message, msg);
          } else if (tag.startsWith('/sign/')) {
            addLog('sign', `Signature event: ${tag}`, msg);
          } else if (tag.startsWith('/ecdh/')) {
            addLog('ecdh', `ECDH event: ${tag}`, msg);
          } else if (tag.startsWith('/ping/')) {
            addLog('bifrost', `Ping event: ${tag}`, msg);
          } else {
            addLog('bifrost', `Message received: ${tag}`, msg);
          }
        } else {
          addLog('bifrost', 'Message received (no tag)', msg);
        }
      } catch (error) {
        addLog('bifrost', 'Error parsing message event', { error, originalMessage: msg });
      }
    };

    // Add event listener
    node.on('message', messageHandler);

    // Return cleanup function
    return () => {
      try {
        node.off('message', messageHandler);
      } catch (error) {
        console.warn('Error removing message event listener:', error);
      }
    };
  }, [addLog]);

  const setupLegacyEventListeners = useCallback((node: BifrostNode) => {
    const cleanupFunctions: (() => void)[] = [];

    // Legacy direct event listeners for backward compatibility
    const legacyEvents = [
      // ECDH events
      { event: '/ecdh/sender/req', type: 'ecdh', message: 'ECDH request sent' },
      { event: '/ecdh/sender/res', type: 'ecdh', message: 'ECDH responses received' },
      { event: '/ecdh/handler/req', type: 'ecdh', message: 'ECDH request received' },
      { event: '/ecdh/handler/res', type: 'ecdh', message: 'ECDH response sent' },
      // Signature events
      { event: '/sign/sender/req', type: 'sign', message: 'Signature request sent' },
      { event: '/sign/sender/res', type: 'sign', message: 'Signature responses received' },
      { event: '/sign/handler/req', type: 'sign', message: 'Signature request received' },
      { event: '/sign/handler/res', type: 'sign', message: 'Signature response sent' },
      // Note: Ping events are handled by the main message handler - no duplicates needed
    ];

    const emitter = node as unknown as {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      off: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    legacyEvents.forEach(({ event, type, message }) => {
      try {
        const handler = (msg: unknown) => addLog(type, message, msg);
        emitter.on(event, handler);
        cleanupFunctions.push(() => {
          try {
            emitter.off(event, handler);
          } catch {
            // Silently ignore cleanup errors for legacy events
          }
        });
      } catch {
        // Silently ignore if event doesn't exist
      }
    });

    // Special handlers for events with different signatures
    try {
      const ecdhSenderRejHandler = (reason: string, pkg: ECDHPackage) =>
        addLog('ecdh', `ECDH request rejected: ${reason}`, pkg);
      const ecdhSenderRetHandler = (reason: string, pkgs: string) =>
        addLog('ecdh', `ECDH shares aggregated: ${reason}`, pkgs);
      const ecdhSenderErrHandler = (reason: string, msgs: unknown[]) =>
        addLog('ecdh', `ECDH share aggregation failed: ${reason}`, msgs);
      const ecdhHandlerRejHandler = (reason: string, msg: unknown) =>
        addLog('ecdh', `ECDH rejection sent: ${reason}`, msg);

      node.on('/ecdh/sender/rej', ecdhSenderRejHandler);
      node.on('/ecdh/sender/ret', ecdhSenderRetHandler);
      node.on('/ecdh/sender/err', ecdhSenderErrHandler);
      node.on('/ecdh/handler/rej', ecdhHandlerRejHandler);

      cleanupFunctions.push(() => {
        try {
          node.off('/ecdh/sender/rej', ecdhSenderRejHandler);
          node.off('/ecdh/sender/ret', ecdhSenderRetHandler);
          node.off('/ecdh/sender/err', ecdhSenderErrHandler);
          node.off('/ecdh/handler/rej', ecdhHandlerRejHandler);
        } catch (error) {
          console.warn('Error removing ECDH event listeners:', error);
        }
      });

      const signSenderRejHandler = (reason: string, pkg: SignSessionPackage) =>
        addLog('sign', `Signature request rejected: ${reason}`, pkg);
      const signSenderRetHandler = (reason: string, msgs: SignatureEntry[]) =>
        addLog('sign', `Signature shares aggregated: ${reason}`, msgs);
      const signSenderErrHandler = (reason: string, msgs: unknown[]) =>
        addLog('sign', `Signature share aggregation failed: ${reason}`, msgs);
      const signHandlerRejHandler = (reason: string, msg: unknown) =>
        addLog('sign', `Signature rejection sent: ${reason}`, msg);

      node.on('/sign/sender/rej', signSenderRejHandler);
      node.on('/sign/sender/ret', signSenderRetHandler);
      node.on('/sign/sender/err', signSenderErrHandler);
      node.on('/sign/handler/rej', signHandlerRejHandler);

      cleanupFunctions.push(() => {
        try {
          node.off('/sign/sender/rej', signSenderRejHandler);
          node.off('/sign/sender/ret', signSenderRetHandler);
          node.off('/sign/sender/err', signSenderErrHandler);
          node.off('/sign/handler/rej', signHandlerRejHandler);
        } catch (error) {
          console.warn('Error removing signature event listeners:', error);
        }
      });

      // Note: Ping events are handled by the main message handler and PeerList component
      // No need for additional ping event handlers here as they create duplicate/useless logs
    } catch (e) {
      addLog('bifrost', 'Error setting up some legacy event listeners', e);
    }

    // Return consolidated cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.warn('Error in legacy event listener cleanup:', error);
        }
      });
    };
  }, [addLog]);

  // Clean up event listeners before node cleanup
  const cleanupEventListeners = useCallback(() => {
    cleanupListenersRef.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error cleaning up event listeners:', error);
      }
    });
    cleanupListenersRef.current = [];
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      try {
        keepAliveRef.current.stop();
      } catch (error) {
        console.warn('Error stopping keep-alive manager:', error);
      }
      keepAliveRef.current = null;
    }
  }, []);

  // Clean node cleanup using igloo-core
  const cleanupNode = useCallback(() => {
    stopKeepAlive();
    if (nodeRef.current) {
      // First clean up our event listeners
      cleanupEventListeners();

      // Temporarily suppress console.warn to hide expected igloo-core warnings
      const originalWarn = console.warn;
      const warnOverride = (message: string, ...args: unknown[]) => {
        // Only suppress the specific expected warning about removeAllListeners
        if (typeof message === 'string' && message.includes('removeAllListeners not available')) {
          return; // Skip this expected warning
        }
        originalWarn(message, ...args);
      };
      console.warn = warnOverride;

      try {
        // Use igloo-core's cleanup - it handles the manual cleanup internally
        cleanupBifrostNode(nodeRef.current);
      } catch (error) {
        console.error('Unexpected error during cleanup:', error);
      } finally {
        // Restore original console.warn
        console.warn = originalWarn;
        nodeRef.current = null;
      }
    }
  }, [cleanupEventListeners, stopKeepAlive]);

  const applyNodeListeners = useCallback((node: BifrostNode) => {
    const cleanupBasic = setupBasicEventListeners(node);
    const cleanupMessage = setupMessageEventListener(node);
    const cleanupLegacy = setupLegacyEventListeners(node);
    cleanupListenersRef.current.push(cleanupBasic, cleanupMessage, cleanupLegacy);
  }, [setupBasicEventListeners, setupMessageEventListener, setupLegacyEventListeners]);

  const registerNode = useCallback((node: BifrostNode) => {
    cleanupEventListeners();
    nodeRef.current = node;
    applyNodeListeners(node);
  }, [applyNodeListeners, cleanupEventListeners]);

  const applySavedPoliciesToNode = useCallback(async (node: BifrostNode, policy: SharePolicy) => {
    const entries = policyEntriesToArray(policy);
    if (entries.length === 0) {
      return;
    }

    try {
      await setNodePolicies(node, entries, { merge: true });
      addLog('info', 'Applied saved peer policies', { count: entries.length });
    } catch (error) {
      addLog('error', 'Failed to apply saved policies', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [addLog]);

  // Add effect to cleanup on unmount
  useEffect(() => {
    // Cleanup function that runs when component unmounts
    return () => {
      if (nodeRef.current) {
        addLog('info', 'Signer stopped due to page navigation');
      }
      cleanupNode();
    };
  }, [addLog, cleanupNode]); // Include dependencies

  // Prime state from initial data whenever it changes
  useEffect(() => {
    const decryptedShare = initialData?.decryptedShare ?? initialData?.share ?? "";
    if (decryptedShare) {
      setSignerSecret(decryptedShare);
      const validation = validateShare(decryptedShare);
      setIsShareValid(validation.isValid);
    } else {
      setSignerSecret("");
      setIsShareValid(false);
    }

    if (initialData?.groupCredential) {
      setGroupCredential(initialData.groupCredential);
      const validation = validateGroup(initialData.groupCredential);
      setIsGroupValid(validation.isValid);
    } else {
      setGroupCredential("");
      setIsGroupValid(false);
    }

    const normalizedPolicy = normalizeSharePolicy(initialData?.shareRecord?.policy);
    setShareRecord(initialData?.shareRecord ?? null);
    setSharePolicy(normalizedPolicy);
    sharePolicyRef.current = normalizedPolicy;
  }, [initialData]);

  useEffect(() => {
    sharePolicyRef.current = sharePolicy;
  }, [sharePolicy]);

  const handleCopy = async (text: string, field: 'group' | 'share') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [field]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [field]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleExpanded = (id: 'group' | 'share') => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Memoize decoded data to avoid repeated decoding on every render
  // Only decode when the corresponding pane is expanded to improve performance
  const decodedGroupData = useMemo(() => {
    if (!expandedItems.group || !groupCredential || !isGroupValid) return null;
    try {
      return decodeGroup(groupCredential);
    } catch (error) {
      console.warn('Failed to decode group credential:', error);
      return null;
    }
  }, [expandedItems.group, groupCredential, isGroupValid]);

  const decodedShareData = useMemo(() => {
    if (!expandedItems.share || !signerSecret || !isShareValid) return null;
    try {
      return decodeShare(signerSecret);
    } catch (error) {
      console.warn('Failed to decode share credential:', error);
      return null;
    }
  }, [expandedItems.share, signerSecret, isShareValid]);

  const persistPolicyChange = useCallback(async ({
    pubkey,
    allowSend,
    allowReceive
  }: {
    pubkey: string;
    allowSend: boolean;
    allowReceive: boolean;
  }) => {
    if (!shareRecord) {
      addLog('bifrost', 'Skipping policy persistence: share not backed by saved file', {
        pubkey
      });
      return;
    }

    const currentPolicy = sharePolicyRef.current;
    const { next, changed } = updatePolicyEntryForPeer(currentPolicy, pubkey, allowSend, allowReceive);

    if (!changed) {
      return;
    }

    const previousPolicy = currentPolicy;
    setSharePolicy(next);
    sharePolicyRef.current = next;

    const updatedShareRecord: IglooShare = {
      ...shareRecord,
      policy: next,
      savedAt: new Date().toISOString()
    };

    try {
      const success = await clientShareManager.saveShare(updatedShareRecord);
      if (!success) {
        throw new Error('Share manager rejected policy update');
      }
      setShareRecord(updatedShareRecord);
      addLog('info', 'Persisted peer policy', { pubkey, allowSend, allowReceive });
    } catch (error) {
      sharePolicyRef.current = previousPolicy;
      setSharePolicy(previousPolicy);
      addLog('error', 'Failed to persist peer policy', {
        pubkey,
        allowSend,
        allowReceive,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }, [shareRecord, addLog]);

  const renderDecodedInfo = (data: unknown, rawString?: string) => {
    // Safe JSON stringification with error handling
    const getJsonString = (obj: unknown): string => {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (error) {
        // Handle circular references and other serialization errors
        try {
          // Attempt to stringify with a replacer function to handle circular refs
          const seen = new WeakSet();
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
            }
            return value;
          }, 2);
        } catch {
          // Final fallback - show error message
          return `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
        }
      }
    };

    return (
      <div className="space-y-3">
        {rawString && (
          <div className="space-y-1">
            <div className="text-xs text-gray-400 font-medium">Raw String:</div>
            <div className="bg-gray-900/50 p-3 rounded text-xs text-blue-300 font-mono break-all">
              {rawString}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <div className="text-xs text-gray-400 font-medium">Decoded Data:</div>
          <pre className="bg-gray-900/50 p-3 rounded text-xs text-blue-300 font-mono overflow-x-auto">
            {getJsonString(data)}
          </pre>
        </div>
      </div>
    );
  };

  const handleShareChange = (value: string) => {
    setSignerSecret(value);
    const validation = validateShare(value);

    // Try deeper validation with bifrost decoder if basic validation passes
    if (validation.isValid && value.trim()) {
      try {
        // If this doesn't throw, it's a valid share
        const decodedShare = decodeShare(value);

        // Additional structure validation could be done here
        if (typeof decodedShare.idx !== 'number' ||
          typeof decodedShare.seckey !== 'string' ||
          typeof decodedShare.binder_sn !== 'string' ||
          typeof decodedShare.hidden_sn !== 'string') {
          setIsShareValid(false);
          return;
        }

        setIsShareValid(true);
      } catch {
        setIsShareValid(false);
      }
    } else {
      setIsShareValid(validation.isValid);
    }
  };

  const handleGroupChange = (value: string) => {
    setGroupCredential(value);
    const validation = validateGroup(value);

    // Try deeper validation with bifrost decoder if basic validation passes
    if (validation.isValid && value.trim()) {
      try {
        // If this doesn't throw, it's a valid group
        const decodedGroup = decodeGroup(value);

        // Additional structure validation
        if (typeof decodedGroup.threshold !== 'number' ||
          typeof decodedGroup.group_pk !== 'string' ||
          !Array.isArray(decodedGroup.commits) ||
          decodedGroup.commits.length === 0) {
          setIsGroupValid(false);
          return;
        }

        setIsGroupValid(true);
      } catch {
        setIsGroupValid(false);
      }
    } else {
      setIsGroupValid(validation.isValid);
    }
  };

  const handleAddRelay = () => {
    if (newRelayUrl && !relayUrls.includes(newRelayUrl)) {
      setRelayUrls([...relayUrls, newRelayUrl]);
      setNewRelayUrl("");
    }
  };

  const handleRemoveRelay = (urlToRemove: string) => {
    setRelayUrls(relayUrls.filter(url => url !== urlToRemove));
  };

  const handleStartSigner = async () => {
    if (!isShareValid || !isGroupValid || relayUrls.length === 0) {
      addLog('error', 'Missing or invalid required fields');
      return;
    }

    try {
      // Ensure cleanup before starting
      cleanupNode();
      setIsConnecting(true);
      addLog('info', 'Creating and connecting node...');

      const selfPubkeyResult = extractSelfPubkeyFromCredentials(
        groupCredential,
        signerSecret,
        {
          normalize: true,
          suppressWarnings: true
        }
      );
      const selfPubkey = selfPubkeyResult.pubkey;

      // Use the improved createConnectedNode API which returns enhanced state info
      const result = await createConnectedNode({
        group: groupCredential,
        share: signerSecret,
        relays: relayUrls
      });

      registerNode(result.node);
      await applySavedPoliciesToNode(result.node, sharePolicyRef.current);

      // Use the enhanced state info from createConnectedNode
      if (result.state.isReady) {
        addLog('info', 'Node connected and ready');
        setIsConnecting(false);
        updateSignerRunning(true);
      } else {
        addLog('warning', 'Node created but not yet ready, waiting...');
        // Keep connecting state until ready
      }

      if (selfPubkey) {
        const keepAlive = createSignerKeepAlive({
          node: result.node,
          groupCredential,
          shareCredential: signerSecret,
          relays: relayUrls,
          selfPubkey,
          logger: (level, message, context) => {
            if (level === 'warn' || level === 'error') {
              const logType = level === 'error' ? 'error' : 'bifrost';
              addLog(logType, `Keep-alive: ${message}`, context);
            }
          }
        });

        keepAlive.onReplace(({ next, previous }) => {
          if (!isSignerRunningRef.current) {
            return;
          }
          addLog('bifrost', 'Keep-alive replaced signer node', {
            relays: relayUrls,
            previousPubkey: previous.pubkey
          });

          registerNode(next);
          void applySavedPoliciesToNode(next, sharePolicyRef.current);
          updateSignerRunning(true);
          setIsConnecting(false);

          if (previous && previous !== next) {
            try {
              cleanupBifrostNode(previous);
            } catch (cleanupError) {
              addLog('bifrost', 'Failed to cleanup replaced node', {
                error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
              });
            }
          }
        });

        keepAliveRef.current = keepAlive;
        keepAlive.start();
      } else {
        addLog('bifrost', 'Keep-alive disabled: unable to derive self pubkey', {
          warnings: selfPubkeyResult.warnings
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Failed to start signer', { error: errorMessage });
      cleanupNode();
      updateSignerRunning(false);
      setIsConnecting(false);
    }
  };

  const handleStopSigner = async () => {
    try {
      cleanupNode();
      addLog('info', 'Signer stopped');
      updateSignerRunning(false);
      setIsConnecting(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Failed to stop signer', { error: errorMessage });
    }
  };

  const handleSignerButtonClick = () => {
    if (isSignerRunning) {
      handleStopSigner();
    } else {
      handleStartSigner();
    }
  };

  return (
    <div className="space-y-6">
      {/* Add the pulse style */}
      <style>{pulseStyle}</style>
      <div className="flex items-center">
        <h2 className="text-blue-300 text-lg">Start your signer to handle requests</h2>
        <Tooltip
          trigger={<HelpCircle size={18} className="ml-2 text-blue-400 cursor-pointer" />}
          position="right"
          content={
            <>
              <p className="mb-2 font-semibold">Important:</p>
              <p>The signer must be running to handle signature requests from clients. When active, it will communicate with other nodes through your configured relays.</p>
            </>
          }
        />
      </div>

      {/* Share Information Header */}
      {(() => {
        const shareInfo = getShareInfo(
          groupCredential,
          signerSecret,
          shareRecord?.name ?? initialData?.shareRecord?.name ?? initialData?.name
        );
        return shareInfo && isGroupValid && isShareValid ? (
          <div className="border border-blue-800/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-400" />
                <span className="text-blue-200 font-medium">{shareInfo.shareName}</span>
              </div>
              <div className="text-gray-400">•</div>
              <div className="text-gray-300 text-sm">
                Index: <span className="text-blue-400 font-mono">{shareInfo.index}</span>
              </div>
              <div className="text-gray-400">•</div>
              <div className="text-gray-300 text-sm">
                Threshold: <span className="text-blue-400">{shareInfo.threshold}</span>/<span className="text-blue-400">{shareInfo.totalShares}</span>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-gray-300 text-sm">
                Pubkey: <span className="font-mono text-xs truncate block">{shareInfo.pubkey}</span>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex">
            <Tooltip
              trigger={
                <Input
                  type="text"
                  value={groupCredential}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full font-mono"
                  disabled={isSignerRunning || isConnecting}
                  placeholder="Enter your group credential (bfgroup...)"
                  aria-label="Group credential input"
                />
              }
              position="top"
              triggerClassName="w-full block"
              content={
                <>
                  <p className="mb-2 font-semibold">Group Credential:</p>
                  <p>
                    This is your group data that contains the public information about
                    your keyset, including the threshold and group public key. It starts
                    with &apos;bfgroup&apos; and is shared among all signers. It is used to
                    identify the group and the threshold for signing.
                  </p>
                </>
              }
            />
            <Tooltip
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(groupCredential, 'group')}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!groupCredential || !isGroupValid}
                  aria-label="Copy group credential"
                >
                  {copiedStates.group ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </Button>
              }
              position="top"
              width="w-fit"
              content="Copy"
            />
            <Tooltip
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleExpanded('group')}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!groupCredential || !isGroupValid}
                  aria-label="Toggle group credential details"
                >
                  {expandedItems['group'] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </Button>
              }
              position="top"
              width="w-fit"
              content="Decoded"
            />
          </div>

          {expandedItems['group'] && groupCredential && isGroupValid && (
            <div className="mt-2 space-y-4">
              {decodedGroupData ? (
                renderDecodedInfo(decodedGroupData, groupCredential)
              ) : (
                <div className="bg-red-900/30 p-3 rounded text-xs text-red-300">
                  Failed to decode group credential
                </div>
              )}
              <div className="flex flex-col items-center bg-white p-4 rounded-lg">
                <QRCodeSVG value={groupCredential} size={200} level="H" />
                <p className="mt-2 text-xs text-gray-600">Group Credential</p>
              </div>
            </div>
          )}

          <div className="flex">
            <Tooltip
              trigger={
                <Input
                  type="password"
                  value={signerSecret}
                  onChange={(e) => handleShareChange(e.target.value)}
                  className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full font-mono"
                  disabled={isSignerRunning || isConnecting}
                  placeholder="Enter your secret share (bfshare...)"
                  aria-label="Secret share input"
                />
              }
              position="top"
              triggerClassName="w-full block"
              content={
                <>
                  <p className="mb-2 font-semibold">Secret Share:</p>
                  <p>This is an individual secret share of the private key. Your keyset is split into shares and this is one of them. It starts with &apos;bfshare&apos; and should be kept private and secure. Each signer needs a share to participate in signing.</p>
                </>
              }
            />
            <Tooltip
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(signerSecret, 'share')}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!signerSecret || !isShareValid}
                  aria-label="Copy secret share"
                >
                  {copiedStates.share ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </Button>
              }
              position="top"
              width="w-fit"
              content="Copy"
            />
            <Tooltip
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleExpanded('share')}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!signerSecret || !isShareValid}
                  aria-label="Toggle share details"
                >
                  {expandedItems['share'] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </Button>
              }
              position="top"
              width="w-fit"
              content="Decoded"
            />
          </div>

          {expandedItems['share'] && signerSecret && isShareValid && (
            <div className="mt-2 space-y-4">
              {decodedShareData ? (
                renderDecodedInfo(decodedShareData, signerSecret)
              ) : (
                <div className="bg-red-900/30 p-3 rounded text-xs text-red-300">
                  Failed to decode share credential
                </div>
              )}
              <div className="flex flex-col items-center bg-white p-4 rounded-lg">
                <QRCodeSVG value={signerSecret} size={200} level="H" />
                <p className="mt-2 text-xs text-gray-600">Share Credential</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isSignerRunning
                  ? 'bg-green-500 pulse-animation'
                  : isConnecting
                    ? 'bg-yellow-500 pulse-animation'
                    : 'bg-red-500'
                }`}></div>
              <span className="text-gray-300">
                Signer {
                  isSignerRunning ? 'Running' :
                    isConnecting ? 'Connecting...' :
                      'Stopped'
                }
              </span>
            </div>
            <Button
              onClick={handleSignerButtonClick}
              className={`px-6 py-2 ${isSignerRunning
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
                } transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer`}
              disabled={!isShareValid || !isGroupValid || relayUrls.length === 0 || isConnecting}
            >
              {isSignerRunning ? "Stop Signer" : isConnecting ? "Connecting..." : "Start Signer"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center">
            <h3 className="text-blue-300 text-sm font-medium">Relay URLs</h3>
            <Tooltip
              trigger={<HelpCircle size={16} className="ml-2 text-blue-400 cursor-pointer" />}
              position="right"
              content={
                <>
                  <p className="mb-2 font-semibold">Important:</p>
                  <p>You must be connected to at least one relay to communicate with other signers. Ensure all signers have at least one common relay to coordinate successfully.</p>
                </>
              }
            />
          </div>
          <div className="flex">
            <Input
              type="text"
              placeholder="Add relay URL"
              value={newRelayUrl}
              onChange={(e) => setNewRelayUrl(e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full"
              disabled={isSignerRunning || isConnecting}
            />
            <Button
              onClick={handleAddRelay}
              className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
              disabled={!newRelayUrl.trim() || isSignerRunning || isConnecting}
            >
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {relayUrls.map((relay, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-800/30 py-2 px-3 rounded-md">
                <span className="text-blue-300 text-sm font-mono">{relay}</span>
                <IconButton
                  variant="destructive"
                  size="sm"
                  icon={<X className="h-4 w-4" />}
                  onClick={() => handleRemoveRelay(relay)}
                  tooltip="Remove relay"
                  disabled={isSignerRunning || isConnecting || relayUrls.length <= 1}
                />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Peer List and Event Log with consistent spacing */}
      <div className="space-y-4">
        <PeerList
          node={nodeRef.current}
          groupCredential={groupCredential}
          shareCredential={signerSecret}
          isSignerRunning={isSignerRunning}
          disabled={!isGroupValid || !isShareValid}
          onPolicyChange={persistPolicyChange}
        />

        <EventLog
          logs={logs}
          isSignerRunning={isSignerRunning}
          onClearLogs={() => setLogs([])}
        />
      </div>
    </div>
  );
});

Signer.displayName = 'Signer';

export default Signer;
export type { SignerHandle }; 
