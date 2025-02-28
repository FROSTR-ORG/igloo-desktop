import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { get_node } from "@/lib/bifrost"

const Signer: React.FC = () => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [signerSecret, setSignerSecret] = useState("");
  const [relayUrls, setRelayUrls] = useState<string[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [groupCredential, setGroupCredential] = useState("");
  
  const nodeRef = useRef<any>(null);

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
      return;
    }

    try {
      const node = get_node({ 
        group: groupCredential, 
        share: signerSecret, 
        relays: relayUrls 
      });

      nodeRef.current = node;

      node.client.on('ready', () => {
        console.log('node connected');
        setIsSignerRunning(true);
      });
      
      node.client.on('message', (msg) => {
        console.log('received message event:', msg);
      });

      node.client.on('error', (error) => {
        console.error('node error:', error);
        setIsSignerRunning(false);
      });

      node.client.on('disconnect', () => {
        console.log('node disconnected');
        setIsSignerRunning(false);
      });

      await node.connect();
    } catch (error) {
      console.error('Failed to start signer:', error);
      setIsSignerRunning(false);
    }
  };

  const handleStopSigner = async () => {
    try {
      if (nodeRef.current) {
        await nodeRef.current.disconnect();
        nodeRef.current = null;
      }
      setIsSignerRunning(false);
    } catch (error) {
      console.error('Failed to stop signer:', error);
    }
  };

  const handleSignerButtonClick = () => {
    if (isSignerRunning) {
      handleStopSigner();
    } else {
      handleStartSigner();
    }
  };

  useEffect(() => {
    return () => {
      if (nodeRef.current) {
        nodeRef.current.disconnect();
      }
    };
  }, []);

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-blue-200">Remote Signer</CardTitle>
        <CardDescription className="text-blue-400 text-sm">Start/Stop your remote signer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Enter group data (ex: bfgroup1q...)"
            value={groupCredential}
            onChange={(e) => setGroupCredential(e.target.value)}
            className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
            disabled={isSignerRunning}
          />
          
          <Input
            type="password"
            placeholder="Enter share (ex: bfshare1q...)"
            value={signerSecret}
            onChange={(e) => setSignerSecret(e.target.value)}
            className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
            disabled={isSignerRunning}
          />
          
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
      </CardContent>
    </Card>
  );
};

export default Signer; 