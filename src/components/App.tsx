import React, { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { generateRandomKeyset, generateKeysetWithSecret, get_node } from "@/lib/bifrost"
import FrostrLogo from "@/assets/frostr-logo-transparent.png"

const App: React.FC = () => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [keysetGenerated, setKeysetGenerated] = useState<{ success: boolean; location: string | React.ReactNode }>({ success: false, location: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const [signerSecret, setSignerSecret] = useState("");
  const [relayUrls, setRelayUrls] = useState<string[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [totalKeys, setTotalKeys] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  const [groupCredential, setGroupCredential] = useState("");

  const [importSecret, setImportSecret] = useState("");
  const [importTotalKeys, setImportTotalKeys] = useState<number>(3);
  const [importThreshold, setImportThreshold] = useState<number>(2);
  const [isImporting, setIsImporting] = useState(false);

  const nodeRef = useRef<any>(null);

  const formatKeysetDisplay = (keyset: any) => {
    return (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium mb-1">Group Credential:</div>
          <div className="bg-gray-800/50 p-2 rounded text-xs break-all">
            {keyset.groupCredential}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Share Credentials:</div>
          <div className="space-y-2">
            {keyset.shareCredentials.map((share: string, index: number) => (
              <div key={index} className="bg-gray-800/50 p-2 rounded text-xs break-all">
                {share}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleGenerateKeyset = async () => {
    setIsGenerating(true);
    try {
      const keyset = generateRandomKeyset(threshold, totalKeys);
      setKeysetGenerated({ 
        success: true, 
        location: formatKeysetDisplay(keyset)
      });
      console.log("Generated keyset:", keyset);
    } catch (error: any) {
      setKeysetGenerated({ 
        success: false, 
        location: `Error generating keyset: ${error.message}` 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportKeyset = async () => {
    if (!importSecret.trim()) return;
    
    setIsImporting(true);
    try {
      const keyset = generateKeysetWithSecret(importThreshold, importTotalKeys, importSecret);
      setKeysetGenerated({ 
        success: true, 
        location: formatKeysetDisplay(keyset)
      });
      console.log("Imported keyset:", keyset);
    } catch (error: any) {
      setKeysetGenerated({ 
        success: false, 
        location: `Error importing keyset: ${error.message}` 
      });
    } finally {
      setIsImporting(false);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center mb-12">
          <img src={FrostrLogo} alt="Frostr Logo" className="w-12 h-12 mr-2" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
        </div>
        <p className="mb-12 text-blue-400 text-center max-w-xl mx-auto text-sm">
          Frostr keyset manager and remote signer.
        </p>

        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-900/50">
            <TabsTrigger value="keys" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Keys</TabsTrigger>
            <TabsTrigger value="signer" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Signer</TabsTrigger>
          </TabsList>

          <TabsContent value="keys">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Create Keyset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="p-4 rounded-lg border border-blue-900/30">
                  <h3 className="text-blue-200 text-sm font-medium mb-4">Generate new nsec and create keyset</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label htmlFor="total-keys" className="text-blue-200 text-sm font-medium" role="label">
                        Total Keys
                      </label>
                      <Input
                        id="total-keys"
                        type="number"
                        min={2}
                        value={totalKeys}
                        onChange={(e) => setTotalKeys(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="threshold" className="text-blue-200 text-sm font-medium">
                        Threshold
                      </label>
                      <Input
                        id="threshold"
                        type="number"
                        min={2}
                        max={totalKeys}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateKeyset} 
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating..." : "Generate keyset"}
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-purple-900/30">
                  <h3 className="text-purple-200 text-sm font-medium mb-4">Import existing nsec and create keyset</h3>
                  <div className="space-y-4">
                    <Input
                      type="password"
                      placeholder="Enter your nsec or hex private key"
                      value={importSecret}
                      onChange={(e) => setImportSecret(e.target.value)}
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      disabled={isImporting}
                    />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <label htmlFor="import-total-keys" className="text-purple-200 text-sm font-medium">
                          Total Keys
                        </label>
                        <Input
                          id="import-total-keys"
                          type="number"
                          min={2}
                          value={importTotalKeys}
                          onChange={(e) => setImportTotalKeys(Number(e.target.value))}
                          className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                          disabled={isImporting}
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="import-threshold" className="text-purple-200 text-sm font-medium">
                          Threshold
                        </label>
                        <Input
                          id="import-threshold"
                          type="number"
                          min={2}
                          max={importTotalKeys}
                          value={importThreshold}
                          onChange={(e) => setImportThreshold(Number(e.target.value))}
                          className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                          disabled={isImporting}
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleImportKeyset}
                      className="w-full py-5 bg-purple-600 hover:bg-purple-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isImporting || !importSecret.trim()}
                    >
                      {isImporting ? "Importing..." : "Import nsec"}
                    </Button>
                  </div>
                </div>

                {keysetGenerated.location && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    keysetGenerated.success ? 'bg-green-900/30 text-green-200' : 'bg-red-900/30 text-red-200'
                  }`}>
                    {keysetGenerated.location}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signer">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App;
