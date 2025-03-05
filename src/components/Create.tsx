import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateKeysetWithSecret } from "@/lib/bifrost"
import { generateNsec, nsecToHex } from "@/lib/nostr"
import { ArrowLeft } from 'lucide-react';
import { clientShareManager } from '@/lib/clientShareManager';

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
  const [isValidNsec, setIsValidNsec] = useState(false);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [isNameValid, setIsNameValid] = useState(true);

  useEffect(() => {
    const loadExistingNames = async () => {
      const shares = await clientShareManager.getShares();
      if (shares) {
        const names = shares.map(share => share.name.split(' share ')[0]);
        setExistingNames(names);
      }
    };
    loadExistingNames();
  }, []);

  const handleNameChange = (value: string) => {
    setKeysetName(value);
    if (value.trim()) {
      const nameWithoutShare = value.split(' share ')[0];
      setIsNameValid(!existingNames.includes(nameWithoutShare));
    } else {
      setIsNameValid(false);
    }
  };

  const handleGenerateNsec = async () => {
    setIsGenerating(true);
    try {
      const { nsec: newNsec } = generateNsec();
      setNsec(newNsec);
      setIsValidNsec(true);
      setKeysetGenerated({
        success: true,
        location: "New nsec key generated successfully"
      });
    } catch (error: any) {
      setKeysetGenerated({
        success: false,
        location: `Error generating nsec: ${error.message}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNsecChange = (value: string) => {
    setNsec(value);
    if (value.trim()) {
      try {
        // Try to convert to hex to validate the nsec
        nsecToHex(value);
        setIsValidNsec(true);
      } catch (error) {
        setIsValidNsec(false);
      }
    } else {
      setIsValidNsec(false);
    }
  };

  const handleCreateKeyset = async () => {
    if (!keysetName.trim() || !nsec.trim() || !isValidNsec || !isNameValid) return;

    setIsGenerating(true);
    try {
      // Convert nsec to hex before passing to bifrost
      const hexKey = nsecToHex(nsec);
      const keyset = generateKeysetWithSecret(threshold, totalKeys, hexKey);

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
              onChange={(e) => handleNameChange(e.target.value)}
              className={`bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm ${
                keysetName && !isNameValid ? 'border-red-500' : ''
              }`}
              disabled={isGenerating}
            />
            {keysetName && !isNameValid && (
              <p className="text-red-400 text-sm">This keyset name already exists</p>
            )}
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
                onChange={(e) => handleNsecChange(e.target.value)}
                className={`bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm flex-1 ${
                  nsec && !isValidNsec ? 'border-red-500' : ''
                }`}
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
            {nsec && !isValidNsec && (
              <p className="text-red-400 text-sm">Invalid nsec format</p>
            )}
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
        </div>

        <Button
          onClick={handleCreateKeyset}
          className="w-full py-5 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isGenerating || !keysetName.trim() || !nsec.trim() || !isValidNsec || !isNameValid}
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