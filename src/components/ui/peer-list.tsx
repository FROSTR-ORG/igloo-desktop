import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  createPeerManagerRobust,
  decodeGroup,
  normalizePubkey,
  comparePubkeys,
  extractSelfPubkeyFromCredentials,
  getNodePolicies,
  updateNodePolicy
} from '@frostr/igloo-core';
import type { BifrostNode } from '@frostr/bifrost';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { RefreshCw, ChevronDown, ChevronUp, Radio, SlidersHorizontal, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodePolicySummary } from '@frostr/igloo-core';

const toPolicyKey = (pubkey: string): string => {
  if (!pubkey || typeof pubkey !== 'string') {
    return '';
  }

  const normalized = normalizePubkey(pubkey);
  if (typeof normalized === 'string' && normalized.length > 0) {
    return normalized.toLowerCase();
  }

  return pubkey.toLowerCase();
};

const createDefaultPolicySummary = (pubkey: string): NodePolicySummary => ({
  pubkey,
  allowSend: true,
  allowReceive: true,
  status: 'unknown',
  source: 'runtime'
});

const getPolicyToggleClasses = (isAllowed: boolean, canEdit: boolean) => cn(
  'h-8 px-3 text-xs font-semibold tracking-wide uppercase font-mono border rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-500 disabled:bg-gray-800/20 disabled:opacity-60',
  isAllowed
    ? 'text-green-300 border-green-500/40 bg-green-900/10 hover:bg-green-900/20'
    : 'text-red-300 border-red-500/40 bg-red-900/10 hover:bg-red-900/20',
  !canEdit && 'opacity-80'
);

interface PeerStatus {
  pubkey: string;
  online: boolean;
  lastSeen?: Date;
  latency?: number;
  lastPingAttempt?: Date;
}

interface PeerListProps {
  node: BifrostNode | null;
  groupCredential: string;
  shareCredential: string;
  isSignerRunning: boolean;
  disabled?: boolean;
  className?: string;
}

const PeerList: React.FC<PeerListProps> = ({
  node,
  groupCredential,
  shareCredential,
  isSignerRunning,
  disabled = false,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [peers, setPeers] = useState<PeerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfPubkey, setSelfPubkey] = useState<string | null>(null);
  const [pingingPeers, setPingingPeers] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isInitialPingSweep, setIsInitialPingSweep] = useState(false);
  const [policies, setPolicies] = useState<Map<string, NodePolicySummary>>(new Map());
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyPanelPeer, setPolicyPanelPeer] = useState<string | null>(null);
  const [policySavingPeers, setPolicySavingPeers] = useState<Set<string>>(new Set());
  const [policyPeerErrors, setPolicyPeerErrors] = useState<Map<string, string>>(new Map());

  const wasSignerRunningRef = useRef(false);

  useEffect(() => {
    if (isSignerRunning && !wasSignerRunningRef.current && !isExpanded) {
      setIsExpanded(true);
    }

    wasSignerRunningRef.current = isSignerRunning;
  }, [isSignerRunning, isExpanded]);

  // Filter out self pubkey using the new comparePubkeys utility
  const filteredPeers = useMemo(() => {
    if (!selfPubkey) return peers;
    
    return peers.filter(peer => {
      const isSelf = comparePubkeys(peer.pubkey, selfPubkey);
      if (isSelf) {
        console.debug(`[PeerList] Filtering out self pubkey: ${peer.pubkey}`);
      }
      return !isSelf;
    });
  }, [peers, selfPubkey]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredPeers.length;
    const online = filteredPeers.filter(p => p.online).length;
    const offline = total - online;
    const avgPing = filteredPeers
      .filter(p => p.latency && p.latency > 0)
      .reduce((acc, p, _, arr) => acc + (p.latency! / arr.length), 0);
    
    return {
      total,
      online,
      offline,
      avgPing: avgPing > 0 ? Math.round(avgPing) : null
    };
  }, [filteredPeers]);

  const loadPolicies = useCallback(() => {
    if (!node) return;

    try {
      setPolicyLoading(true);
      const summaries = getNodePolicies(node);
      const map = new Map<string, NodePolicySummary>();

      summaries.forEach(summary => {
        const key = toPolicyKey(summary.pubkey);
        map.set(key, { ...summary, pubkey: key });
      });

      setPolicies(map);
      setPolicyError(null);
      setPolicyPeerErrors(new Map());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load policies';
      setPolicyError(message);
    } finally {
      setPolicyLoading(false);
    }
  }, [node]);

  const getPolicyForPeer = useCallback((pubkey: string): NodePolicySummary => {
    const key = toPolicyKey(pubkey);
    return policies.get(key) ?? createDefaultPolicySummary(key);
  }, [policies]);

  // Setup ping event listeners for real-time status updates
  const setupPingEventListeners = useCallback(() => {
    if (!node) return () => {};

    console.debug('[PeerList] Setting up ping event listeners');

    const handlePingRequest = (msg: any) => {
      if (msg?.from) {
        const normalizedFrom = normalizePubkey(msg.from);
        console.debug(`[PeerList] Ping request from: ${msg.from} -> ${normalizedFrom}`);
        
        setPeers(prev => prev.map(peer => {
          if (comparePubkeys(peer.pubkey, msg.from)) {
            return {
              ...peer,
              online: true,
              lastSeen: new Date()
            };
          }
          return peer;
        }));
      }
    };

    const handlePingResponse = (msg: any) => {
      if (msg?.from) {
        const normalizedFrom = normalizePubkey(msg.from);
        const latency = msg.latency || (msg.timestamp ? Date.now() - msg.timestamp : undefined);
        console.debug(`[PeerList] Ping response from: ${msg.from} -> ${normalizedFrom}${latency ? ` (${latency}ms)` : ''}`);
        
        setPeers(prev => prev.map(peer => {
          if (comparePubkeys(peer.pubkey, msg.from)) {
            return {
              ...peer,
              online: true,
              lastSeen: new Date(),
              latency: latency || peer.latency
            };
          }
          return peer;
        }));
      }
    };

    // Listen to the message event for ping messages
    const handleMessage = (msg: any) => {
      if (msg?.tag === '/ping/req') {
        handlePingRequest(msg);
      } else if (msg?.tag === '/ping/res') {
        handlePingResponse(msg);
      }
    };
    
    node.on('message', handleMessage);

    return () => {
      try {
        node.off('message', handleMessage);
        console.debug('[PeerList] Ping event listeners cleaned up');
      } catch (error) {
        console.warn('[PeerList] Error cleaning up ping listeners:', error);
      }
    };
  }, [node]);

  useEffect(() => {
    if (!node || !isSignerRunning || disabled) {
      setPolicies(new Map());
      setPolicyError(null);
      setPolicyPanelPeer(null);
      setPolicySavingPeers(new Set());
      setPolicyPeerErrors(new Map());
      setPolicyLoading(false);
      return;
    }

    loadPolicies();
  }, [node, isSignerRunning, disabled, loadPolicies]);

  // Initialize peer manager and setup listeners
  useEffect(() => {
    if (!isSignerRunning || !node || !groupCredential || !shareCredential || disabled) {
      setPeers([]);
      setError(null);
      setSelfPubkey(null);
      setIsInitialPingSweep(false);
      return;
    }

    let isActive = true;
    let peerManager: any = null;
    let cleanupPingListeners: (() => void) | null = null;

    const initializePeerList = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Extract self pubkey using the new utility
        const selfPubkeyResult = extractSelfPubkeyFromCredentials(
          groupCredential,
          shareCredential,
          { 
            normalize: true,
            suppressWarnings: true 
          }
        );
        
        if (isActive && selfPubkeyResult.pubkey) {
          setSelfPubkey(selfPubkeyResult.pubkey);
          console.debug(`[PeerList] Extracted self pubkey: ${selfPubkeyResult.pubkey}`);
        } else if (selfPubkeyResult.warnings.length > 0) {
          console.debug(`[PeerList] Could not extract self pubkey:`, selfPubkeyResult.warnings);
        }

        // Create peer manager with enhanced configuration (no more console.warn workaround!)
        try {
          peerManager = await createPeerManagerRobust(
            node,
            groupCredential,
            shareCredential,
            {
              pingInterval: 10000, // 10 seconds for better responsiveness
              suppressWarnings: true, // Clean suppression instead of global override
              customLogger: (level, message, data) => {
                // Use debug level for expected warnings to keep console clean
                if (level === 'warn') {
                  console.debug(`[PeerList] ${message}`, data);
                } else {
                  console[level](`[PeerList] ${message}`, data);
                }
              }
            }
          );
          console.debug('[PeerList] Peer manager created successfully for monitoring');
        } catch (peerManagerError) {
          // Gracefully handle peer manager creation issues
          console.debug('[PeerList] Peer manager creation had issues, continuing with manual peer management:', peerManagerError);
        }

        if (!isActive) return;

        // Extract peers directly from group credential - this is reliable
        let peerList: string[] = [];
        try {
          const decodedGroup = decodeGroup(groupCredential);
          if (decodedGroup?.commits && Array.isArray(decodedGroup.commits)) {
            peerList = decodedGroup.commits.map(commit => 
              typeof commit === 'string' ? commit : commit.pubkey
            );
            console.debug('[PeerList] Extracted', peerList.length, 'peers from group credential');
          } else {
            throw new Error('Invalid group structure - no commits found');
          }
        } catch (extractionError) {
          console.error('[PeerList] Failed to extract peers from group credential:', extractionError);
          throw new Error('Unable to extract peer list from group credential');
        }
        console.debug(`[PeerList] Initial peer list:`, peerList);
        
        const initialPeers: PeerStatus[] = peerList.map((pubkey: string) => ({
          pubkey,
          online: false,
          lastSeen: undefined,
          latency: undefined
        }));

        setPeers(initialPeers);

        // Setup ping event listeners for real-time updates
        cleanupPingListeners = setupPingEventListeners();

        // Perform initial ping sweep to detect online peers immediately
        console.debug('[PeerList] Performing initial ping sweep to detect online peers');
        
        // Small delay to ensure peer manager is fully initialized
        setTimeout(async () => {
          if (!isActive) return;
          
          setIsInitialPingSweep(true);
          
          try {
            const pingPromises = initialPeers.map(async (peer) => {
              const normalizedPubkey = normalizePubkey(peer.pubkey);
              try {
                const startTime = Date.now();
                const result = await Promise.race([
                  node.req.ping(normalizedPubkey),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)) // Shorter timeout for initial sweep
                ]);
                
                const latency = Date.now() - startTime;
                
                if ((result as any).ok) {
                  console.debug(`[PeerList] Initial ping successful to ${normalizedPubkey} (${latency}ms)`);
                  if (isActive) {
                    setPeers(prev => prev.map(p => {
                      if (comparePubkeys(p.pubkey, peer.pubkey)) {
                        return { ...p, online: true, lastSeen: new Date(), latency };
                      }
                      return p;
                    }));
                  }
                } else {
                  // Peer is offline, no need to update (already initialized as offline)
                  console.debug(`[PeerList] Initial ping timeout to ${normalizedPubkey}`);
                }
              } catch (error) {
                // Handle errors gracefully during initial sweep
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (!errorMessage.includes('peer data not found') && !errorMessage.includes('Timeout')) {
                  console.debug(`[PeerList] Initial ping error to ${normalizedPubkey}:`, error);
                }
                // Peer remains offline (already initialized as offline)
              }
            });

            await Promise.allSettled(pingPromises);
            console.debug('[PeerList] Initial ping sweep completed');
          } catch (error) {
            console.warn('[PeerList] Error during initial ping sweep:', error);
          } finally {
            if (isActive) {
              setIsInitialPingSweep(false);
            }
          }
        }, 500); // 500ms delay to ensure everything is ready

      } catch (error) {
        console.error('[PeerList] Failed to initialize peer manager:', error);
        if (isActive) {
          setError(error instanceof Error ? error.message : 'Failed to initialize peer list');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    initializePeerList();

    return () => {
      isActive = false;
      if (cleanupPingListeners) {
        cleanupPingListeners();
      }
      if (peerManager && typeof peerManager.cleanup === 'function') {
        try {
          peerManager.cleanup();
        } catch (error) {
          console.warn('[PeerList] Error cleaning up peer manager:', error);
        }
      }
    };
  }, [isSignerRunning, node, groupCredential, shareCredential, disabled, setupPingEventListeners]);

  // Ping individual peer
  const handlePolicyPanelToggle = useCallback((peerPubkey: string) => {
    const key = toPolicyKey(peerPubkey);
    setPolicyPanelPeer(prev => (prev === key ? null : key));
  }, []);

  const handlePolicyToggle = useCallback(async (peerPubkey: string, field: 'send' | 'receive') => {
    if (!node || !isSignerRunning || disabled) return;

    const key = toPolicyKey(peerPubkey);

    if (policySavingPeers.has(key)) return;

    const currentPolicy = getPolicyForPeer(peerPubkey);
    const nextAllowSend = field === 'send' ? !currentPolicy.allowSend : currentPolicy.allowSend;
    const nextAllowReceive = field === 'receive' ? !currentPolicy.allowReceive : currentPolicy.allowReceive;

    setPolicySavingPeers(prev => {
      const updated = new Set(prev);
      updated.add(key);
      return updated;
    });

    setPolicyPeerErrors(prev => {
      const updated = new Map(prev);
      updated.delete(key);
      return updated;
    });

    try {
      const updatedSummary = updateNodePolicy(node, {
        pubkey: key,
        allowSend: nextAllowSend,
        allowReceive: nextAllowReceive,
        source: 'runtime'
      });

      if (!updatedSummary) {
        throw new Error('Policy update failed to apply');
      }

      const normalizedKey = toPolicyKey(updatedSummary.pubkey);

      setPolicies(prev => {
        const updated = new Map(prev);
        updated.set(normalizedKey, { ...updatedSummary, pubkey: normalizedKey });
        return updated;
      });
      setPolicyError(null);
    } catch (policyUpdateError) {
      const message = policyUpdateError instanceof Error ? policyUpdateError.message : 'Failed to update policy';
      setPolicyPeerErrors(prev => {
        const updated = new Map(prev);
        updated.set(key, message);
        return updated;
      });
    } finally {
      setPolicySavingPeers(prev => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  }, [node, isSignerRunning, disabled, policySavingPeers, getPolicyForPeer]);

  const handlePingPeer = useCallback(async (peerPubkey: string) => {
    if (!node || !isSignerRunning) return;

    const normalizedPubkey = normalizePubkey(peerPubkey);
    setPingingPeers(prev => new Set(prev).add(normalizedPubkey));

    try {
      const startTime = Date.now();
      console.debug(`[PeerList] Manual ping sent to ${peerPubkey} -> ${normalizedPubkey}`);
      
      const result = await node.req.ping(normalizedPubkey);
      const latency = Date.now() - startTime;
      
      if (result.ok) {
        console.debug(`[PeerList] Manual ping successful to ${normalizedPubkey} (${latency}ms)`);
        setPeers(prev => prev.map(peer => {
          if (comparePubkeys(peer.pubkey, peerPubkey)) {
            return {
              ...peer,
              online: true,
              lastSeen: new Date(),
              latency: latency
            };
          }
          return peer;
        }));
      } else {
        console.info(`[PeerList] Ping timeout to ${normalizedPubkey} - this is normal in P2P networks`);
        setPeers(prev => prev.map(peer => {
          if (comparePubkeys(peer.pubkey, peerPubkey)) {
            return {
              ...peer,
              online: false,
              lastPingAttempt: new Date()
            };
          }
          return peer;
        }));
      }
    } catch (error) {
      // Handle specific "peer data not found" error more gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('peer data not found')) {
        console.info(`[PeerList] Peer ${normalizedPubkey} not yet discovered by node - this is normal in P2P networks`);
        setPeers(prev => prev.map(peer => {
          if (comparePubkeys(peer.pubkey, peerPubkey)) {
            return {
              ...peer,
              online: false,
              lastPingAttempt: new Date()
            };
          }
          return peer;
        }));
      } else {
        console.warn(`[PeerList] Ping failed to ${normalizedPubkey}:`, error);
        setPeers(prev => prev.map(peer => {
          if (comparePubkeys(peer.pubkey, peerPubkey)) {
            return {
              ...peer,
              online: false,
              lastPingAttempt: new Date()
            };
          }
          return peer;
        }));
      }
    } finally {
      setPingingPeers(prev => {
        const newSet = new Set(prev);
        newSet.delete(normalizedPubkey);
        return newSet;
      });
    }
  }, [node, isSignerRunning]);

  // Ping all peers
  const pingAllPeers = useCallback(async () => {
    if (!node || !isSignerRunning || filteredPeers.length === 0) return;

    console.debug(`[PeerList] Pinging all ${filteredPeers.length} peers`);

    const pingPromises = filteredPeers.map(async (peer) => {
      const normalizedPubkey = normalizePubkey(peer.pubkey);
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          node.req.ping(normalizedPubkey),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        
        const latency = Date.now() - startTime;
        
        if ((result as any).ok) {
          setPeers(prev => prev.map(p => {
            if (comparePubkeys(p.pubkey, peer.pubkey)) {
              return { ...p, online: true, lastSeen: new Date(), latency };
            }
            return p;
          }));
        } else {
          setPeers(prev => prev.map(p => {
            if (comparePubkeys(p.pubkey, peer.pubkey)) {
              return { ...p, online: false, lastPingAttempt: new Date() };
            }
            return p;
          }));
        }
      } catch (error) {
        // Handle "peer data not found" errors gracefully
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('peer data not found')) {
          console.debug(`[PeerList] Ping error to ${normalizedPubkey}:`, error);
        }
        setPeers(prev => prev.map(p => {
          if (comparePubkeys(p.pubkey, peer.pubkey)) {
            return { ...p, online: false, lastPingAttempt: new Date() };
          }
          return p;
        }));
      }
    });

    await Promise.allSettled(pingPromises);
  }, [node, isSignerRunning, filteredPeers]);

  // Enhanced refresh that includes pinging
  const handleRefresh = useCallback(async () => {
    if (!node || !isSignerRunning) return;

    setIsRefreshing(true);
    try {
      // First refresh peer discovery
      console.debug('[PeerList] Refreshing peer list and pinging all peers');
      
      // Then ping all known peers for immediate status update
      await pingAllPeers();
      loadPolicies();
    } finally {
      setIsRefreshing(false);
    }
  }, [node, isSignerRunning, pingAllPeers, loadPolicies]);

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
  };

  const getStatusIndicator = () => {
    if (!isSignerRunning) return 'error';
    if (stats.online > 0) return 'success';
    if (stats.total > 0) return 'warning';
    return 'default';
  };

  const actions = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 italic">
        {isExpanded ? "Click to collapse" : "Click to expand"}
      </span>
      <IconButton
        variant="default"
        size="sm"
        icon={<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
        onClick={(e) => {
          e.stopPropagation();
          handleRefresh();
        }}
        tooltip="Refresh peer list and ping all"
        disabled={!isSignerRunning || disabled || isRefreshing}
      />
    </div>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Collapsible Header */}
      <div 
        className="flex items-center justify-between bg-gray-800/50 p-2.5 rounded cursor-pointer hover:bg-gray-800/70 transition-colors"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? 
            <ChevronUp className="h-4 w-4 text-blue-400" /> : 
            <ChevronDown className="h-4 w-4 text-blue-400" />
          }
          <span className="text-blue-200 text-sm font-medium select-none">Peer List</span>
          
          {/* Status indicators */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              getStatusIndicator() === 'success' ? 'bg-green-500' :
              getStatusIndicator() === 'warning' ? 'bg-yellow-500' :
              getStatusIndicator() === 'error' ? 'bg-red-500' : 'bg-gray-500'
            )}></div>
            
            {stats.total > 0 && (
              <>
                <Badge variant="success" className="text-xs px-1.5 py-0.5">
                  {stats.online} online
                </Badge>
                <Badge variant="default" className="text-xs px-1.5 py-0.5">
                  {stats.total} total
                </Badge>
                {stats.avgPing && (
                  <Badge variant="info" className="text-xs px-1.5 py-0.5">
                    Avg: {stats.avgPing}ms
                  </Badge>
                )}
              </>
            )}
            
            {error && (
              <Badge variant="error" className="text-xs px-1.5 py-0.5">
                Error
              </Badge>
            )}
          </div>
        </div>
        <div onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      </div>

      {/* Collapsible Content */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[400px] opacity-100 overflow-visible" : "max-h-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="bg-gray-900/30 rounded border border-gray-800/30 p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-blue-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading peers...</span>
              </div>
            </div>
          ) : isInitialPingSweep ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-blue-400">
                <Radio className="h-4 w-4 animate-pulse" />
                <span className="text-sm">Detecting online peers...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <p className="text-red-400 text-sm">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="text-blue-400 hover:text-blue-300"
                  disabled={!isSignerRunning}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : filteredPeers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-500 text-sm">
                {!isSignerRunning ? 'Start signer to discover peers' : 'No peers discovered yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Peer list */}
              <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/30">
                {policyError && (
                  <div className="bg-red-900/20 border border-red-900/40 text-red-300 text-xs rounded px-3 py-2">
                    Unable to load peer policies: {policyError}
                  </div>
                )}
                {filteredPeers.map((peer) => {
                  const normalizedPubkey = normalizePubkey(peer.pubkey);
                  const policyKey = toPolicyKey(peer.pubkey);
                  const isPinging = pingingPeers.has(normalizedPubkey);
                  const policySummary = getPolicyForPeer(peer.pubkey);
                  const isPolicyOpen = policyPanelPeer === policyKey;
                  const isPolicySaving = policySavingPeers.has(policyKey);
                  const peerPolicyError = policyPeerErrors.get(policyKey);
                  const canEditPolicies = isSignerRunning && !disabled;
                  const policyButtonDisabled = disabled;
                  const outboundLabel = policySummary.allowSend ? 'allow' : 'block';
                  const inboundLabel = policySummary.allowReceive ? 'allow' : 'block';
                  
                  return (
                    <div key={peer.pubkey} className="space-y-2">
                      <div className="flex items-center justify-between bg-gray-800/30 p-3 rounded border border-gray-700/30">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Tooltip
                            trigger={
                              <div className={cn(
                                "w-3 h-3 rounded-full flex-shrink-0",
                                peer.online ? 'bg-green-500' : 'bg-red-500'
                              )}></div>
                            }
                            content={
                              peer.online 
                                ? `Online${peer.lastSeen ? ` - Last seen: ${peer.lastSeen.toLocaleTimeString()}` : ''}` 
                                : `Offline - Timeouts are normal in P2P networks where peers may not be reachable directly`
                            }
                            position="top"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="text-blue-300 text-sm font-mono truncate">
                              {peer.pubkey.slice(0, 16)}...{peer.pubkey.slice(-8)}
                            </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 whitespace-nowrap overflow-x-auto">
                            <span className="whitespace-nowrap">Status: {peer.online ? 'Online' : 'Offline'}</span>
                            {peer.latency && (
                              <span className="whitespace-nowrap">• Ping: {peer.latency}ms</span>
                            )}
                            {peer.lastSeen && (
                              <span className="whitespace-nowrap">• Last seen: {peer.lastSeen.toLocaleTimeString()}</span>
                            )}
                            {!peer.online && peer.lastPingAttempt && (
                              <span className="whitespace-nowrap">• Last attempt: {peer.lastPingAttempt.toLocaleTimeString()}</span>
                            )}
                            <span className="whitespace-nowrap">• Policy: out {outboundLabel}, in {inboundLabel}</span>
                          </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2">
                          <IconButton
                            variant="outline"
                            size="sm"
                            icon={<SlidersHorizontal className={cn("h-3 w-3", isPolicyOpen && 'text-blue-300')} />}
                            onClick={() => handlePolicyPanelToggle(peer.pubkey)}
                            tooltip={canEditPolicies ? 'Configure peer policy' : 'View peer policy'}
                            disabled={policyButtonDisabled}
                            className={cn(
                              "transition-all duration-200",
                              isPolicyOpen && "bg-blue-500/20 border-blue-500/40"
                            )}
                          />
                          <IconButton
                            variant="default"
                            size="sm"
                            icon={<Radio className="h-3 w-3" />}
                            onClick={() => handlePingPeer(peer.pubkey)}
                            tooltip="Ping this peer"
                            disabled={!isSignerRunning || disabled || isPinging}
                            className={cn(
                              "transition-all duration-200",
                              isPinging && "animate-pulse"
                            )}
                          />
                        </div>
                      </div>

                      {isPolicyOpen && (
                        <div className="ml-6 mr-2 bg-gray-900/40 border border-gray-800/60 rounded p-3 text-xs text-gray-300 relative overflow-visible">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-200">Policy controls</span>
                            <Tooltip
                              position="top"
                              width="w-64"
                              triggerClassName="cursor-help"
                              focusable
                              trigger={<HelpCircle className="h-3.5 w-3.5 text-blue-400" />}
                              content={
                                <div className="space-y-1 text-blue-100">
                                  <p>Directional policies determine whether this peer can receive (inbound) or initiate (outbound) signing traffic with your node.</p>
                                  <p className="text-blue-200/80">For smoother coordination keep outbound enabled only for the minimal set of online peers and disable it for peers you know are offline.</p>
                                </div>
                              }
                            />
                            {policyLoading && (
                              <Badge variant="info" className="uppercase tracking-wide">Refreshing…</Badge>
                            )}
                            {isPolicySaving && (
                              <Badge variant="info" className="uppercase tracking-wide">Saving…</Badge>
                            )}
                            {policySummary.source === 'config' && (
                              <Badge variant="orange" className="uppercase tracking-wide">From config</Badge>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={getPolicyToggleClasses(policySummary.allowSend, canEditPolicies)}
                              onClick={() => handlePolicyToggle(peer.pubkey, 'send')}
                              disabled={!canEditPolicies || isPolicySaving}
                            >
                              {`Outbound ${outboundLabel}`}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={getPolicyToggleClasses(policySummary.allowReceive, canEditPolicies)}
                              onClick={() => handlePolicyToggle(peer.pubkey, 'receive')}
                              disabled={!canEditPolicies || isPolicySaving}
                            >
                              {`Inbound ${inboundLabel}`}
                            </Button>
                          </div>
                          {!canEditPolicies && (
                            <div className="mt-2">
                              <Badge variant="warning" className="uppercase tracking-wide">Start signer to edit policies</Badge>
                            </div>
                          )}
                          <div className="mt-2 text-[11px] text-gray-500">
                            Outbound controls requests you initiate; inbound gates requests arriving from this peer.
                          </div>
                          {peerPolicyError && (
                            <div className="mt-2 text-red-400">
                              {peerPolicyError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeerList; 
