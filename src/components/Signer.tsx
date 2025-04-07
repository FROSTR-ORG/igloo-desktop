import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { get_node } from "@/lib/bifrost"
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react"
import type { SignatureEntry } from '@frostr/bifrost'
import { EventLog, type LogEntryData } from "./EventLog"
import { InputWithValidation } from "@/components/ui/input-with-validation"
import { RelayInput } from "@/components/ui/relay-input"
import { validateShare, validateGroup } from "@/lib/validation"
import { decode_share, decode_group } from "@/lib/bifrost"

interface SignerProps {
  initialData?: {
    share: string;
    groupCredential: string;
  } | null;
}

const DEFAULT_RELAY = "wss://relay.primal.net";

const Signer: React.FC<SignerProps> = ({ initialData }) => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [signerSecret, setSignerSecret] = useState(initialData?.share || "");
  const [isShareValid, setIsShareValid] = useState(false);
  const [shareError, setShareError] = useState<string | undefined>(undefined);
  
  const [relayUrls, setRelayUrls] = useState<string[]>([DEFAULT_RELAY]);
  
  const [groupCredential, setGroupCredential] = useState(initialData?.groupCredential || "");
  const [isGroupValid, setIsGroupValid] = useState(false);
  const [groupError, setGroupError] = useState<string | undefined>(undefined);
  
  const [copiedStates, setCopiedStates] = useState({
    group: false,
    share: false
  });
  const [logs, setLogs] = useState<LogEntryData[]>([]);
  const [showEventLog, setShowEventLog] = useState(false);
  
  const nodeRef = useRef<any>(null);

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

        // Disconnect the node
        nodeRef.current.disconnect();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      
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
      <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-blue-200">FROSTR Remote Signer</h2>
              <CardDescription className="text-blue-400">
                Sign events remotely from this device using your share
              </CardDescription>
            </div>
            <div>
              <Button
                onClick={handleSignerButtonClick}
                className={`px-6 py-2 ${
                  isSignerRunning
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer`}
                disabled={!isShareValid || !isGroupValid || relayUrls.length === 0}
              >
                {isSignerRunning ? "Stop Signer" : "Start Signer"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-6 w-full">
            <div className="space-y-2 w-full">
              <InputWithValidation
                label="Share Credential"
                type="password"
                placeholder="Enter your bfshare1... credential"
                value={signerSecret}
                onChange={handleShareChange}
                isValid={isShareValid}
                errorMessage={shareError}
                isRequired={true}
                disabled={isSignerRunning}
                className="w-full"
              />

              <div className="flex gap-2 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(signerSecret, 'share')}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 h-8 px-2"
                  title="Copy share"
                >
                  {copiedStates.share ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2 w-full">
              <InputWithValidation
                label="Group Credential"
                type="password"
                placeholder="Enter your bfgroup1... credential"
                value={groupCredential}
                onChange={handleGroupChange}
                isValid={isGroupValid}
                errorMessage={groupError}
                isRequired={true}
                disabled={isSignerRunning}
                className="w-full"
              />

              <div className="flex gap-2 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(groupCredential, 'group')}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 h-8 px-2"
                  title="Copy group"
                >
                  {copiedStates.group ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <RelayInput
              relays={relayUrls}
              onChange={setRelayUrls}
              className="space-y-4 w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-blue-200">Event Log</h2>
            <Button
              variant="ghost"
              onClick={() => setShowEventLog(!showEventLog)}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
            >
              {showEventLog ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
        </CardHeader>
        {showEventLog && (
          <CardContent>
            <EventLog 
              logs={logs} 
              isSignerRunning={isSignerRunning} 
              onClearLogs={() => setLogs([])}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default Signer; 