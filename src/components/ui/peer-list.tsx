import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  createPeerManagerRobust, 
  decodeShare, 
  decodeGroup,
  normalizePubkey,
  comparePubkeys,
  extractSelfPubkeyFromCredentials
} from '@frostr/igloo-core';
import type { BifrostNode } from '@frostr/bifrost';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { RefreshCw, ChevronDown, ChevronUp, RadioTower, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    } finally {
      setIsRefreshing(false);
    }
  }, [node, isSignerRunning, pingAllPeers]);

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
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
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
                {filteredPeers.map((peer) => {
                  const normalizedPubkey = normalizePubkey(peer.pubkey);
                  const isPinging = pingingPeers.has(normalizedPubkey);
                  
                  return (
                    <div key={peer.pubkey} className="flex items-center justify-between bg-gray-800/30 p-3 rounded border border-gray-700/30">
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
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>Status: {peer.online ? 'Online' : 'Offline'}</span>
                            {peer.latency && (
                              <span>• Ping: {peer.latency}ms</span>
                            )}
                            {peer.lastSeen && (
                              <span>• Last seen: {peer.lastSeen.toLocaleTimeString()}</span>
                            )}
                            {!peer.online && peer.lastPingAttempt && (
                              <span>• Last attempt: {peer.lastPingAttempt.toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <IconButton
                        variant="default"
                        size="sm"
                        icon={<Radio className="h-3 w-3" />}
                        onClick={() => handlePingPeer(peer.pubkey)}
                        tooltip="Ping this peer"
                        disabled={!isSignerRunning || disabled || isPinging}
                        className={cn(
                          "ml-2 transition-all duration-200",
                          isPinging && "animate-pulse"
                        )}
                      />
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