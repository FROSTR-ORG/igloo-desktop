import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip } from "@/components/ui/tooltip"
import { createConnectedNode, validateShare, validateGroup, decodeShare, decodeGroup, cleanupBifrostNode } from "@frostr/igloo-core"
import { Copy, Check, X, HelpCircle } from "lucide-react"
import type { SignatureEntry, ECDHPackage, SignSessionPackage, BifrostNode } from '@frostr/bifrost'
import { EventLog, type LogEntryData } from "./EventLog"
import { Input } from "@/components/ui/input"
import type { 
  SignerHandle, 
  SignerProps
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

const Signer = forwardRef<SignerHandle, SignerProps>(({ initialData }, ref) => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [signerSecret, setSignerSecret] = useState(initialData?.share || "");
  const [isShareValid, setIsShareValid] = useState(false);
  const [relayUrls, setRelayUrls] = useState<string[]>([DEFAULT_RELAY]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  
  const [groupCredential, setGroupCredential] = useState(initialData?.groupCredential || "");
  const [isGroupValid, setIsGroupValid] = useState(false);
  
  const [copiedStates, setCopiedStates] = useState({
    group: false,
    share: false
  });
  const [logs, setLogs] = useState<LogEntryData[]>([]);
  
  const nodeRef = useRef<BifrostNode | null>(null);
  
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

  // Extracted event handling functions for cleaner code
  const setupBasicEventListeners = useCallback((node: BifrostNode) => {
    node.on('closed', () => {
      addLog('bifrost', 'Bifrost node is closed');
      setIsSignerRunning(false);
      setIsConnecting(false);
    });
    
    node.on('error', (error: unknown) => {
      addLog('error', 'Node error', error);
      setIsSignerRunning(false);
      setIsConnecting(false);
    });
    
    node.on('ready', (data: unknown) => {
      addLog('ready', 'Node is ready', data);
      setIsConnecting(false);
      setIsSignerRunning(true);
    });
    
    node.on('bounced', (reason: string, msg: unknown) => 
      addLog('bifrost', `Message bounced: ${reason}`, msg)
    );
  }, [addLog, setIsSignerRunning, setIsConnecting]);

  const setupMessageEventListener = useCallback((node: BifrostNode) => {
    node.on('message', (msg: unknown) => {
      try {
        if (msg && typeof msg === 'object' && 'tag' in msg) {
          const messageData = msg as { tag: string; [key: string]: unknown };
          const tag = messageData.tag;
          
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
    });
  }, [addLog]);

  const setupLegacyEventListeners = useCallback((node: BifrostNode) => {
    const nodeAny = node as any;
    
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
      // Ping events
      { event: '/ping/sender/req', type: 'bifrost', message: 'Ping request sent' },
      { event: '/ping/sender/res', type: 'bifrost', message: 'Ping response received' },
      { event: '/ping/handler/req', type: 'bifrost', message: 'Ping request received' },
      { event: '/ping/handler/res', type: 'bifrost', message: 'Ping response sent' },
    ];

    legacyEvents.forEach(({ event, type, message }) => {
      try {
        nodeAny.on(event, (msg: unknown) => addLog(type, message, msg));
      } catch (e) {
        // Silently ignore if event doesn't exist
      }
    });

    // Special handlers for events with different signatures
    try {
      node.on('/ecdh/sender/rej', (reason: string, pkg: ECDHPackage) => 
        addLog('ecdh', `ECDH request rejected: ${reason}`, pkg)
      );
      node.on('/ecdh/sender/ret', (reason: string, pkgs: string) => 
        addLog('ecdh', `ECDH shares aggregated: ${reason}`, pkgs)
      );
      node.on('/ecdh/sender/err', (reason: string, msgs: unknown[]) => 
        addLog('ecdh', `ECDH share aggregation failed: ${reason}`, msgs)
      );
      node.on('/ecdh/handler/rej', (reason: string, msg: unknown) => 
        addLog('ecdh', `ECDH rejection sent: ${reason}`, msg)
      );

      node.on('/sign/sender/rej', (reason: string, pkg: SignSessionPackage) => 
        addLog('sign', `Signature request rejected: ${reason}`, pkg)
      );
      node.on('/sign/sender/ret', (reason: string, msgs: SignatureEntry[]) => 
        addLog('sign', `Signature shares aggregated: ${reason}`, msgs)
      );
      node.on('/sign/sender/err', (reason: string, msgs: unknown[]) => 
        addLog('sign', `Signature share aggregation failed: ${reason}`, msgs)
      );
      node.on('/sign/handler/rej', (reason: string, msg: unknown) => 
        addLog('sign', `Signature rejection sent: ${reason}`, msg)
      );

      // Ping events with special signatures
      nodeAny.on('/ping/sender/ret', (reason: string, msg: unknown) => 
        addLog('bifrost', `Ping operation completed: ${reason}`, msg)
      );
      nodeAny.on('/ping/sender/err', (reason: string, msg: unknown) => 
        addLog('bifrost', `Ping operation failed: ${reason}`, msg)
      );
      nodeAny.on('/ping/handler/ret', (reason: string, msg: unknown) => 
        addLog('bifrost', `Ping handled: ${reason}`, msg)
      );
      nodeAny.on('/ping/handler/err', (reason: string, msg: unknown) => 
        addLog('bifrost', `Ping handling failed: ${reason}`, msg)
      );
    } catch (e) {
      addLog('bifrost', 'Error setting up some legacy event listeners', e);
    }
  }, [addLog]);

  // Clean node cleanup using igloo-core
  const cleanupNode = useCallback(() => {
    if (nodeRef.current) {
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
  }, []);

  // Add effect to cleanup on unmount
  useEffect(() => {
    // Cleanup function that runs when component unmounts
    return () => {
      if (nodeRef.current) {
        addLog('info', 'Signer stopped due to page navigation');
        cleanupNode();
      }
    };
  }, [addLog, cleanupNode]); // Include dependencies

  // Validate initial data
  useEffect(() => {
    if (initialData?.share) {
      const validation = validateShare(initialData.share);
      setIsShareValid(validation.isValid);
    }
    
    if (initialData?.groupCredential) {
      const validation = validateGroup(initialData.groupCredential);
      setIsGroupValid(validation.isValid);
    }
  }, [initialData]);

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

      // Use the improved createConnectedNode API which returns enhanced state info
      const result = await createConnectedNode({ 
        group: groupCredential, 
        share: signerSecret, 
        relays: relayUrls 
      });

      nodeRef.current = result.node;

      // Set up all event listeners using our extracted functions
      setupBasicEventListeners(result.node);
      setupMessageEventListener(result.node);
      setupLegacyEventListeners(result.node);

      // Use the enhanced state info from createConnectedNode
      if (result.state.isReady) {
        addLog('info', 'Node connected and ready');
        setIsConnecting(false);
        setIsSignerRunning(true);
      } else {
        addLog('warning', 'Node created but not yet ready, waiting...');
        // Keep connecting state until ready
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Failed to start signer', { error: errorMessage });
      cleanupNode();
      setIsSignerRunning(false);
      setIsConnecting(false);
    }
  };

  const handleStopSigner = async () => {
    try {
      cleanupNode();
      addLog('info', 'Signer stopped');
      setIsSignerRunning(false);
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
      
      <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
        <CardContent className="p-8 space-y-8">
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
              </div>
              
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
              </div>
              
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    isSignerRunning 
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
                  className={`px-6 py-2 ${
                    isSignerRunning
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
          
          <EventLog 
            logs={logs} 
            isSignerRunning={isSignerRunning} 
            onClearLogs={() => setLogs([])}
          />
        </CardContent>
      </Card>
    </div>
  );
});

Signer.displayName = 'Signer';

export default Signer;
export type { SignerHandle }; 