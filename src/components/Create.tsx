import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateRandomKeyset, generateKeysetWithSecret } from "@/lib/bifrost"
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface CreateProps {
  onKeysetCreated: (data: { groupCredential: string; shareCredentials: string[]; name: string }) => void;
  onBack: () => void;
}

const Create: React.FC<CreateProps> = ({ onKeysetCreated, onBack }) => {
  const [keysetGenerated, setKeysetGenerated] = useState<{ success: boolean; location: string | React.ReactNode }>({ success: false, location: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalKeys, setTotalKeys] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  const [keysetName, setKeysetName] = useState("");
  const [nsec, setNsec] = useState("");

  const handleGenerateNsec = async () => {
    setIsGenerating(true);
    try {
      const keyset = generateRandomKeyset(threshold, totalKeys);
      setNsec(keyset.groupCredential);
    } catch (error: any) {
      setKeysetGenerated({
        success: false,
        location: `Error generating nsec: ${error.message}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateKeyset = async () => {
    if (!keysetName.trim() || !nsec.trim()) return;

    setIsGenerating(true);
    try {
      const keyset = nsec === keysetGenerated.location ? 
        { groupCredential: nsec, shareCredentials: [] } : // Use the generated keyset
        generateKeysetWithSecret(threshold, totalKeys, nsec); // Generate from provided nsec

      onKeysetCreated({
        ...keyset,
        name: keysetName
      });
    } catch (error: any) {
      setKeysetGenerated({
        success: false,
        location: `Error creating keyset: ${error.message}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center w-full justify-between">
            <CardTitle className="text-xl text-blue-200">Create Keyset</CardTitle>
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="keyset-name" className="text-blue-200 text-sm font-medium">
              Keyset Name
            </label>
            <Input
              id="keyset-name"
              type="text"
              placeholder="Enter a name for this keyset"
              value={keysetName}
              onChange={(e) => setKeysetName(e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                disabled={isGenerating}
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
                disabled={isGenerating}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="nsec" className="text-blue-200 text-sm font-medium">
              nsec or hex private key
            </label>
            <div className="flex gap-2">
              <Input
                id="nsec"
                type="password"
                placeholder="Enter your nsec or generate a new one"
                value={nsec}
                onChange={(e) => setNsec(e.target.value)}
                className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm flex-1"
                disabled={isGenerating}
              />
              <Button
                onClick={handleGenerateNsec}
                className="bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isGenerating}
              >
                Generate
              </Button>
            </div>
          </div>
        </div>

        <Button
          onClick={handleCreateKeyset}
          className="w-full py-5 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isGenerating || !keysetName.trim() || !nsec.trim()}
        >
          {isGenerating ? "Creating..." : "Create keyset"}
        </Button>

        {keysetGenerated.location && (
          <div className={`mt-4 p-3 rounded-lg ${keysetGenerated.success ? 'bg-green-900/30 text-green-200' : 'bg-red-900/30 text-red-200'}`}>
            {keysetGenerated.location}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Create; 