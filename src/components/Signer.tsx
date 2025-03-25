import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { get_node } from "@/lib/bifrost"
import { Copy, Check, Trash2, ChevronDown, ChevronUp, ChevronRight } from "lucide-react"
import type { SignatureEntry } from '@frostr/bifrost'
import { cn } from "@/lib/utils"
import { EventLog, type LogEntryData } from "./EventLog"

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
  const [relayUrls, setRelayUrls] = useState<string[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [groupCredential, setGroupCredential] = useState(initialData?.groupCredential || "");
  const [copiedStates, setCopiedStates] = useState({
    group: false,
    share: false
  });
  const [logs, setLogs] = useState<LogEntryData[]>([]);
  
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

  const handleAddRelay = () => {
    if (newRelayUrl.trim() && !relayUrls.includes(newRelayUrl)) {
      setRelayUrls([...relayUrls, newRelayUrl]);
      setNewRelayUrl("");
    }
  };

  const handleRemoveRelay = (urlToRemove: string) => {
    setRelayUrls(relayUrls.filter(url => url !== urlToRemove));
  };

  const handleStartSigner = async () => {
    if (!signerSecret.trim() || !groupCredential.trim() || relayUrls.length === 0) {
      addLog('error', 'Missing required fields');
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
      setIsSignerRunning(false);
      addLog('info', 'Signer stopped successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Failed to stop signer', { error: errorMessage });
      setIsSignerRunning(false);
    }
  };

  const handleSignerButtonClick = () => {
    if (isSignerRunning) {
      handleStopSigner();
    } else {
      handleStartSigner();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupNode();
    };
  }, []);

  // Validate initialData
  useEffect(() => {
    if (initialData) {
      const isValidData = 
        typeof initialData.share === 'string' && 
        typeof initialData.groupCredential === 'string' &&
        initialData.share.trim() !== '' && 
        initialData.groupCredential.trim() !== '';

      if (!isValidData) {
        return;
      }

      setSignerSecret(initialData.share);
      setGroupCredential(initialData.groupCredential);
      
      if (!relayUrls.includes(DEFAULT_RELAY)) {
        setRelayUrls([DEFAULT_RELAY]);
      }
    }
  }, [initialData]);

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardDescription className="text-blue-400 text-sm">Start/Stop your remote signer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter group data (ex: bfgroup1q...)"
              value={groupCredential}
              onChange={(e) => setGroupCredential(e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
              disabled={isSignerRunning}
            />
            <Button
              onClick={() => handleCopy(groupCredential, 'group')}
              disabled={!groupCredential || isSignerRunning}
              className="bg-blue-600 hover:bg-blue-700 px-3"
              title="Copy group credential"
            >
              {copiedStates.group ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Enter share (ex: bfshare1q...)"
              value={signerSecret}
              onChange={(e) => setSignerSecret(e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
              disabled={isSignerRunning}
            />
            <Button
              onClick={() => handleCopy(signerSecret, 'share')}
              disabled={!signerSecret || isSignerRunning}
              className="bg-blue-600 hover:bg-blue-700 px-3"
              title="Copy share"
            >
              {copiedStates.share ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isSignerRunning ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-blue-300">
                {isSignerRunning ? 'Signer Running' : 'Signer Stopped'}
              </span>
            </div>
            
            <Button
              onClick={handleSignerButtonClick}
              className={`${isSignerRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isSignerRunning ? 'Stop Signer' : 'Start Signer'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-blue-200 text-sm font-medium">Relay URLs</label>
          <div className="flex gap-2 mb-2">
            <Input
              type="text"
              placeholder="Add relay URL"
              value={newRelayUrl}
              onChange={(e) => setNewRelayUrl(e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm flex-1"
              disabled={isSignerRunning}
            />
            <Button
              onClick={handleAddRelay}
              disabled={isSignerRunning || !newRelayUrl.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {relayUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-800/30 p-2 rounded">
                <span className="text-sm text-blue-300 flex-1 break-all">{url}</span>
                <Button
                  onClick={() => handleRemoveRelay(url)}
                  disabled={isSignerRunning}
                  className="bg-red-600 hover:bg-red-700 h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        <EventLog 
          logs={logs}
          isSignerRunning={isSignerRunning}
          onClearLogs={() => setLogs([])}
        />
      </CardContent>
    </Card>
  );
};

export default Signer; 