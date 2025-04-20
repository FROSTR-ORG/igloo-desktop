import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { get_node } from "@/lib/bifrost"
import { Copy, Check, X, HelpCircle } from "lucide-react"
import type { SignatureEntry } from '@frostr/bifrost'
import { EventLog, type LogEntryData } from "./EventLog"
import { Input } from "@/components/ui/input"
import { validateShare, validateGroup } from "@/lib/validation"
import { decode_share, decode_group } from "@/lib/bifrost"

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

interface SignerProps {
  initialData?: {
    share: string;
    groupCredential: string;
  } | null;
}

// Export the handle type for type safety
export interface SignerHandle {
  stopSigner: () => Promise<void>;
}

const DEFAULT_RELAY = "wss://relay.primal.net";

const Signer = forwardRef<SignerHandle, SignerProps>(({ initialData }, ref) => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [signerSecret, setSignerSecret] = useState(initialData?.share || "");
  const [isShareValid, setIsShareValid] = useState(false);
  const [shareError, setShareError] = useState<string | undefined>(undefined);
  
  const [relayUrls, setRelayUrls] = useState<string[]>([DEFAULT_RELAY]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  
  const [groupCredential, setGroupCredential] = useState(initialData?.groupCredential || "");
  const [isGroupValid, setIsGroupValid] = useState(false);
  const [groupError, setGroupError] = useState<string | undefined>(undefined);
  
  const [copiedStates, setCopiedStates] = useState({
    group: false,
    share: false
  });
  const [logs, setLogs] = useState<LogEntryData[]>([]);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showSignerTooltip, setShowSignerTooltip] = useState(false);
  const [showRelayTooltip, setShowRelayTooltip] = useState(false);
  
  const nodeRef = useRef<any>(null);

  // Add effect to cleanup on unmount
  useEffect(() => {
    // Cleanup function that runs when component unmounts
    return () => {
      if (isSignerRunning) {
        addLog('info', 'Signer stopped due to page navigation');
        cleanupNode();
        setIsSignerRunning(false);
      }
    };
  }, []);  // Only run on mount/unmount, not when isSignerRunning changes

  // Expose the stopSigner method to parent components through ref
  useImperativeHandle(ref, () => ({
    stopSigner: async () => {
      console.log('External stopSigner method called');
      if (isSignerRunning) {
        await handleStopSigner();
      }
    }
  }));

  const addLog = (type: string, message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [...prev, { timestamp, type, message, data, id }]);
  };

  // Add cleanup function
  const cleanupNode = () => {
    if (nodeRef.current) {
      try {
        // Remove event listeners
        if (nodeRef.current.listeners) {
          const { ready, message, error, disconnect } = nodeRef.current.listeners;
          nodeRef.current.client?.off('ready', ready);
          nodeRef.current.client?.off('message', message);
          nodeRef.current.client?.off('error', error);
          nodeRef.current.client?.off('disconnect', disconnect);
        }

        // Remove Bifrost specific listeners
        try {
          nodeRef.current.off('ready');
          nodeRef.current.off('closed');
          nodeRef.current.off('message');
          nodeRef.current.off('bounced');

          // Remove ECDH events
          nodeRef.current.off('/ecdh/sender/req');
          nodeRef.current.off('/ecdh/sender/res');
          nodeRef.current.off('/ecdh/sender/rej');
          nodeRef.current.off('/ecdh/sender/ret');
          nodeRef.current.off('/ecdh/sender/err');
          nodeRef.current.off('/ecdh/handler/req');
          nodeRef.current.off('/ecdh/handler/res');
          nodeRef.current.off('/ecdh/handler/rej');

          // Remove Signature events
          nodeRef.current.off('/sign/sender/req');
          nodeRef.current.off('/sign/sender/res');
          nodeRef.current.off('/sign/sender/rej');
          nodeRef.current.off('/sign/sender/ret');
          nodeRef.current.off('/sign/sender/err');
          nodeRef.current.off('/sign/handler/req');
          nodeRef.current.off('/sign/handler/res');
          nodeRef.current.off('/sign/handler/rej');
        } catch (e) {
          console.warn('Error removing event listeners:', e);
        }

        // Thoroughly attempt to disconnect the node
        try {
          // Try calling disconnect on the node itself (if available)
          if (typeof nodeRef.current.disconnect === 'function') {
            nodeRef.current.disconnect();
          }
          
          // Disconnect the client
          if (nodeRef.current.client) {
            // Try force close method if it exists
            if (typeof nodeRef.current.client.close === 'function') {
              nodeRef.current.client.close();
            }
            
            // Try normal disconnect
            if (typeof nodeRef.current.client.disconnect === 'function') {
              nodeRef.current.client.disconnect();
            }
            
            // Null out the client reference
            nodeRef.current.client = null;
          }
        } catch (e) {
          console.warn('Error disconnecting:', e);
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      
      // Completely clear the node reference
      nodeRef.current = null;
    }
  };

  // Validate initial data
  useEffect(() => {
    if (initialData?.share) {
      const validation = validateShare(initialData.share);
      setIsShareValid(validation.isValid);
      setShareError(validation.message);
    }
    
    if (initialData?.groupCredential) {
      const validation = validateGroup(initialData.groupCredential);
      setIsGroupValid(validation.isValid);
      setGroupError(validation.message);
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
        const decodedShare = decode_share(value);
        
        // Additional structure validation could be done here
        if (typeof decodedShare.idx !== 'number' || 
            typeof decodedShare.seckey !== 'string' || 
            typeof decodedShare.binder_sn !== 'string' || 
            typeof decodedShare.hidden_sn !== 'string') {
          setIsShareValid(false);
          setShareError('Share has invalid internal structure');
          return;
        }
        
        setIsShareValid(true);
        setShareError(undefined);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid share structure';
        setIsShareValid(false);
        
        // If the error appears to be related to bech32m decode
        if (errorMessage.includes('malformed') || 
            errorMessage.includes('decode') || 
            errorMessage.includes('bech32')) {
          setShareError('Invalid bfshare format - must be a valid bech32m encoded credential');
        } else {
          setShareError(`Invalid share: ${errorMessage}`);
        }
      }
    } else {
      setIsShareValid(validation.isValid);
      setShareError(validation.message);
    }
  };

  const handleGroupChange = (value: string) => {
    setGroupCredential(value);
    const validation = validateGroup(value);
    
    // Try deeper validation with bifrost decoder if basic validation passes
    if (validation.isValid && value.trim()) {
      try {
        // If this doesn't throw, it's a valid group
        const decodedGroup = decode_group(value);
        
        // Additional structure validation
        if (typeof decodedGroup.threshold !== 'number' || 
            typeof decodedGroup.group_pk !== 'string' || 
            !Array.isArray(decodedGroup.commits) ||
            decodedGroup.commits.length === 0) {
          setIsGroupValid(false);
          setGroupError('Group credential has invalid internal structure');
          return;
        }
        
        setIsGroupValid(true);
        setGroupError(undefined);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid group structure';
        setIsGroupValid(false);
        
        // If the error appears to be related to bech32m decode
        if (errorMessage.includes('malformed') || 
            errorMessage.includes('decode') || 
            errorMessage.includes('bech32')) {
          setGroupError('Invalid bfgroup format - must be a valid bech32m encoded credential');
        } else {
          setGroupError(`Invalid group: ${errorMessage}`);
        }
      }
    } else {
      setIsGroupValid(validation.isValid);
      setGroupError(validation.message);
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

      const node = get_node({ 
        group: groupCredential, 
        share: signerSecret, 
        relays: relayUrls 
      });

      nodeRef.current = node;

      // Store event listener references for cleanup
      const readyListener = () => {
        addLog('ready', 'Node connected');
        setIsSignerRunning(true);
      };
      
      const messageListener = (msg: any) => {
        addLog('message', 'Received message', msg);
      };

      const errorListener = (error: unknown) => {
        addLog('error', 'Node error', error);
        setIsSignerRunning(false);
      };

      const disconnectListener = () => {
        addLog('disconnect', 'Node disconnected');
        setIsSignerRunning(false);
      };

      // Store listeners in nodeRef for cleanup
      nodeRef.current.listeners = {
        ready: readyListener,
        message: messageListener,
        error: errorListener,
        disconnect: disconnectListener
      };

      // Attach listeners
      node.client.on('ready', readyListener);
      node.client.on('message', messageListener);
      node.client.on('error', errorListener);
      node.client.on('disconnect', disconnectListener);

      // Add Bifrost specific event listeners
      node.on('ready', () => addLog('bifrost', 'Bifrost node is ready'));
      node.on('closed', () => addLog('bifrost', 'Bifrost node is closed'));
      node.on('message', (msg: any) => addLog('bifrost', 'Received message', msg));
      node.on('bounced', ([reason, msg]: [string, any]) => addLog('bifrost', `Message bounced: ${reason}`, msg));

      // ECDH events
      node.on('/ecdh/sender/req', (msg: any) => addLog('ecdh', 'ECDH request sent', msg));
      node.on('/ecdh/sender/res', (msgs: any[]) => addLog('ecdh', 'ECDH responses received', msgs));
      node.on('/ecdh/sender/rej', ([reason, pkg]: [string, any]) => addLog('ecdh', `ECDH request rejected: ${reason}`, pkg));
      node.on('/ecdh/sender/ret', ([reason, pkgs]: [string, string]) => addLog('ecdh', `ECDH shares aggregated: ${reason}`, pkgs));
      node.on('/ecdh/sender/err', ([reason, msgs]: [string, any[]]) => addLog('ecdh', `ECDH share aggregation failed: ${reason}`, msgs));
      node.on('/ecdh/handler/req', (msg: any) => addLog('ecdh', 'ECDH request received', msg));
      node.on('/ecdh/handler/res', (msg: any) => addLog('ecdh', 'ECDH response sent', msg));
      node.on('/ecdh/handler/rej', ([reason, msg]: [string, any]) => addLog('ecdh', `ECDH rejection sent: ${reason}`, msg));

      // Signature events
      node.on('/sign/sender/req', (msg: any) => addLog('sign', 'Signature request sent', msg));
      node.on('/sign/sender/res', (msgs: any[]) => addLog('sign', 'Signature responses received', msgs));
      node.on('/sign/sender/rej', ([reason, pkg]: [string, any]) => addLog('sign', `Signature request rejected: ${reason}`, pkg));
      node.on('/sign/sender/ret', ([reason, msgs]: [string, SignatureEntry[]]) => addLog('sign', `Signature shares aggregated: ${reason}`, msgs));
      node.on('/sign/sender/err', ([reason, msgs]: [string, any[]]) => addLog('sign', `Signature share aggregation failed: ${reason}`, msgs));
      node.on('/sign/handler/req', (msg: any) => addLog('sign', 'Signature request received', msg));
      node.on('/sign/handler/res', (msg: any) => addLog('sign', 'Signature response sent', msg));
      node.on('/sign/handler/rej', ([reason, msg]: [string, any]) => addLog('sign', `Signature rejection sent: ${reason}`, msg));

      await node.connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Failed to start signer', { error: errorMessage });
      cleanupNode();
      setIsSignerRunning(false);
    }
  };

  const handleStopSigner = async () => {
    try {
      cleanupNode();
      addLog('info', 'Signer stopped');
      setIsSignerRunning(false);
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
            <div 
              className="ml-2 text-blue-400 cursor-pointer relative"
              onMouseEnter={() => setShowSignerTooltip(true)}
              onMouseLeave={() => setShowSignerTooltip(false)}
            >
              <HelpCircle size={18} />
              {showSignerTooltip && (
                <div className="absolute right-0 w-64 p-3 bg-gray-800 border border-blue-900/50 rounded-md shadow-lg text-xs text-blue-200 z-50">
                  <p className="mb-2 font-semibold">Important:</p>
                  <p>The signer must be running to handle signature requests from clients. When active, it will communicate with other nodes through your configured relays.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex">
                <Input
                  type="text"
                  value={groupCredential}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full font-mono"
                  disabled={isSignerRunning}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(groupCredential, 'group')}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!groupCredential || !isGroupValid}
                >
                  {copiedStates.group ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
              {groupError && (
                <p className="text-red-400 text-sm">{groupError}</p>
              )}
              
              <div className="flex">
                <Input
                  type="password"
                  value={signerSecret}
                  onChange={(e) => handleShareChange(e.target.value)}
                  className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full font-mono"
                  disabled={isSignerRunning}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(signerSecret, 'share')}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!signerSecret || !isShareValid}
                >
                  {copiedStates.share ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
              {shareError && (
                <p className="text-red-400 text-sm">{shareError}</p>
              )}
              
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    isSignerRunning 
                      ? 'bg-green-500 pulse-animation' 
                      : 'bg-red-500'
                  }`}></div>
                  <span className="text-gray-300">Signer {isSignerRunning ? 'Running' : 'Stopped'}</span>
                </div>
                <Button
                  onClick={handleSignerButtonClick}
                  className={`px-6 py-2 ${
                    isSignerRunning
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  } transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer`}
                  disabled={!isShareValid || !isGroupValid || relayUrls.length === 0}
                >
                  {isSignerRunning ? "Stop Signer" : "Start Signer"}
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <h3 className="text-blue-300 text-sm font-medium">Relay URLs</h3>
                <div 
                  className="ml-2 text-blue-400 cursor-pointer relative"
                  onMouseEnter={() => setShowRelayTooltip(true)}
                  onMouseLeave={() => setShowRelayTooltip(false)}
                >
                  <HelpCircle size={16} />
                  {showRelayTooltip && (
                    <div className="absolute right-0 w-72 p-3 bg-gray-800 border border-blue-900/50 rounded-md shadow-lg text-xs text-blue-200 z-50">
                      <p className="mb-2 font-semibold">Important:</p>
                      <p>You must be connected to at least one relay to communicate with other signers. Ensure all signers have at least one common relay to coordinate successfully.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex">
                <Input
                  type="text"
                  placeholder="Add relay URL"
                  value={newRelayUrl}
                  onChange={(e) => setNewRelayUrl(e.target.value)}
                  className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm w-full"
                  disabled={isSignerRunning}
                />
                <Button
                  onClick={handleAddRelay}
                  className="ml-2 bg-blue-800/30 text-blue-400 hover:text-blue-300 hover:bg-blue-800/50"
                  disabled={!newRelayUrl.trim() || isSignerRunning}
                >
                  Add
                </Button>
              </div>
              
              <div className="space-y-2">
                {relayUrls.map((relay, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-800/30 py-2 px-3 rounded-md">
                    <span className="text-blue-300 text-sm font-mono">{relay}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRelay(relay)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-full"
                      disabled={isSignerRunning || relayUrls.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div 
            className="flex items-center justify-between bg-gray-800/50 p-2.5 rounded cursor-pointer hover:bg-gray-800/70 transition-colors"
            onClick={() => setShowEventLog(!showEventLog)}
          >
            <div className="flex items-center gap-2">
              {showEventLog ? 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                  <path d="m18 15-6-6-6 6"/>
                </svg> : 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              }
              <span className="text-blue-300 text-sm font-medium">Event Log</span>
              <div className="flex items-center gap-1.5 bg-gray-900/70 px-2 py-0.5 rounded text-xs">
                <div className={`w-2 h-2 rounded-full ${logs.length === 0 ? "bg-green-500" : isSignerRunning ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-gray-400">{logs.length} events</span>
              </div>
            </div>
            <span className="text-xs text-gray-500 italic">Click to expand</span>
          </div>
          
          {showEventLog && (
            <EventLog 
              logs={logs} 
              isSignerRunning={isSignerRunning} 
              onClearLogs={() => setLogs([])}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default Signer; 