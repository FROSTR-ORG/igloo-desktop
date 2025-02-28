import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateRandomKeyset, generateKeysetWithSecret } from "@/lib/bifrost"

const Create: React.FC = () => {
  const [keysetGenerated, setKeysetGenerated] = useState<{ success: boolean; location: string | React.ReactNode }>({ success: false, location: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalKeys, setTotalKeys] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  
  const [importSecret, setImportSecret] = useState("");
  const [importTotalKeys, setImportTotalKeys] = useState<number>(3);
  const [importThreshold, setImportThreshold] = useState<number>(2);
  const [isImporting, setIsImporting] = useState(false);

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
    } catch (error: any) {
      setKeysetGenerated({ 
        success: false, 
        location: `Error importing keyset: ${error.message}` 
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
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
  );
};

export default Create; 