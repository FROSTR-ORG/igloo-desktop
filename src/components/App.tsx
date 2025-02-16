import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Square, Snowflake } from "lucide-react"
import { generateKeyset } from "@/lib/frost"

const App: React.FC = () => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [keysetGenerated, setKeysetGenerated] = useState<{ success: boolean; location: string | null }>({ success: false, location: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const [signerSecret, setSignerSecret] = useState("");
  const [totalKeys, setTotalKeys] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);

  const [importSecret, setImportSecret] = useState("");
  const [importTotalKeys, setImportTotalKeys] = useState<number>(3);
  const [importThreshold, setImportThreshold] = useState<number>(2);
  const [isImporting, setIsImporting] = useState(false);

  const handleGenerateKeyset = async () => {
    setIsGenerating(true);
    const result = await generateKeyset();
    setKeysetGenerated(result);
    setIsGenerating(false);
  };

  const handleImportKeyset = async () => {
    if (!importSecret.trim()) return;
    
    setIsImporting(true);
    try {
      // TODO: Implement actual import logic
      // const result = await importKeyset(importSecret, importTotalKeys, importThreshold);
      // Handle success
    } catch (error) {
      // Handle error
    } finally {
      setIsImporting(false);
    }
  };

  const handleStartSigner = () => {
    if (signerSecret.trim()) {
      setIsSignerRunning(true);
      // TODO: Implement actual signer start logic
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center mb-12">
          <Snowflake className="w-10 h-10 mr-3" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
        </div>
        <p className="mb-12 text-blue-400 text-center max-w-xl mx-auto text-sm">
          Frostr keyset generator and remote signer.
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
                <CardDescription className="text-blue-400 text-sm">Generate or import Frostr keysets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="p-4 rounded-lg border border-blue-900/30">
                  <h3 className="text-blue-200 text-sm font-medium mb-4">Generate New Keyset</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label htmlFor="total-keys" className="text-blue-200 text-sm font-medium">
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
                    {isGenerating ? "Generating..." : "Generate Keyset"}
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-purple-900/30">
                  <h3 className="text-purple-200 text-sm font-medium mb-4">Import Existing Keyset</h3>
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
                      {isImporting ? "Importing..." : "Import Keyset"}
                    </Button>
                  </div>
                </div>
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
                    type="password"
                    placeholder="Enter frostr share"
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
                      onClick={() => isSignerRunning ? setIsSignerRunning(false) : handleStartSigner()}
                      className={`${isSignerRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {isSignerRunning ? 'Stop Signer' : 'Start Signer'}
                    </Button>
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
