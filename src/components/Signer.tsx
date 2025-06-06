import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip } from "@/components/ui/tooltip"
import { createConnectedNode, validateShare, validateGroup, decodeShare, decodeGroup, cleanupBifrostNode, isNodeReady } from "@frostr/igloo-core"
import { Copy, Check, X, HelpCircle } from "lucide-react"
import type { SignatureEntry, ECDHPackage, SignSessionPackage } from '@frostr/bifrost'
import { EventLog, type LogEntryData } from "./EventLog"
import { Input } from "@/components/ui/input"

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
  const [isConnecting, setIsConnecting] = useState(false);
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
  const [showSignerTooltip, setShowSignerTooltip] = useState(false);
  const [showRelayTooltip, setShowRelayTooltip] = useState(false);
  
  const nodeRef = useRef<any>(null);

  // Add effect to cleanup on unmount
  useEffect(() => {
    // Cleanup function that runs when component unmounts
    return () => {
      if (nodeRef.current) {
        addLog('info', 'Signer stopped due to page navigation');
        cleanupNode();
      }
    };
  }, []); // Empty dependency array means this only runs on mount/unmount
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

  // Clean node cleanup using igloo-core
  const cleanupNode = () => {
    if (nodeRef.current) {
      // Temporarily suppress console.warn to hide expected igloo-core warnings
      const originalWarn = console.warn;
      console.warn = (message: string, ...args: any[]) => {
        // Only suppress the specific expected warning about removeAllListeners
        if (typeof message === 'string' && message.includes('removeAllListeners not available')) {
          return; // Skip this expected warning
        }
        originalWarn(message, ...args);
      };
      
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
        const decodedShare = decodeShare(value);
        
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
        const decodedGroup = decodeGroup(value);
        
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
      setIsConnecting(true);
      addLog('info', 'Creating and connecting node...');

      // Use the improved createConnectedNode API which returns enhanced state info
      const result = await createConnectedNode({ 
        group: groupCredential, 
        share: signerSecret, 
        relays: relayUrls 
      });

      nodeRef.current = result.node;

      // Set up event listeners for state changes
      result.node.on('closed', () => {
        addLog('bifrost', 'Bifrost node is closed');
        setIsSignerRunning(false);
        setIsConnecting(false);
      });
      result.node.on('error', (error: unknown) => {
        addLog('error', 'Node error', error);
        setIsSignerRunning(false);
        setIsConnecting(false);
      });

      // Set up comprehensive event logging
      result.node.on('message', (msg: any) => addLog('bifrost', 'Received message', msg));
      result.node.on('bounced', (reason: string, msg: any) => addLog('bifrost', `Message bounced: ${reason}`, msg));

      // ECDH events
      result.node.on('/ecdh/sender/req', (msg: any) => addLog('ecdh', 'ECDH request sent', msg));
      result.node.on('/ecdh/sender/res', (...msgs: any[]) => addLog('ecdh', 'ECDH responses received', msgs));
      result.node.on('/ecdh/sender/rej', (reason: string, pkg: ECDHPackage) => addLog('ecdh', `ECDH request rejected: ${reason}`, pkg));
      result.node.on('/ecdh/sender/ret', (reason: string, pkgs: string) => addLog('ecdh', `ECDH shares aggregated: ${reason}`, pkgs));
      result.node.on('/ecdh/sender/err', (reason: string, msgs: any[]) => addLog('ecdh', `ECDH share aggregation failed: ${reason}`, msgs));
      result.node.on('/ecdh/handler/req', (msg: any) => addLog('ecdh', 'ECDH request received', msg));
      result.node.on('/ecdh/handler/res', (msg: any) => addLog('ecdh', 'ECDH response sent', msg));
      result.node.on('/ecdh/handler/rej', (reason: string, msg: any) => addLog('ecdh', `ECDH rejection sent: ${reason}`, msg));

      // Signature events
      result.node.on('/sign/sender/req', (msg: any) => addLog('sign', 'Signature request sent', msg));
      result.node.on('/sign/sender/res', (...msgs: any[]) => addLog('sign', 'Signature responses received', msgs));
      result.node.on('/sign/sender/rej', (reason: string, pkg: SignSessionPackage) => addLog('sign', `Signature request rejected: ${reason}`, pkg));
      result.node.on('/sign/sender/ret', (reason: string, msgs: SignatureEntry[]) => addLog('sign', `Signature shares aggregated: ${reason}`, msgs));
      result.node.on('/sign/sender/err', (reason: string, msgs: any[]) => addLog('sign', `Signature share aggregation failed: ${reason}`, msgs));
      result.node.on('/sign/handler/req', (msg: any) => addLog('sign', 'Signature request received', msg));
      result.node.on('/sign/handler/res', (msg: any) => addLog('sign', 'Signature response sent', msg));
      result.node.on('/sign/handler/rej', (reason: string, msg: any) => addLog('sign', `Signature rejection sent: ${reason}`, msg));

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
          with 'bfgroup' and is shared among all signers. It is used to
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
      >
        {copiedStates.group ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      </Button>
    }
    position="top"
    width="w-fit"
    content="Copy"
  />
</div>
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
                    />
                  }
                  position="top"
                  triggerClassName="w-full block"
                  content={
                    <>
                      <p className="mb-2 font-semibold">Secret Share:</p>
                      <p>This is an individual secret share of the private key. Your keyset is split into shares and this is one of them. It starts with 'bfshare' and should be kept private and secure. Each signer needs a share to participate in signing.</p>
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

export default Signer; 