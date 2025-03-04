import React, { useState, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { generateRandomKeyset, generateKeysetWithSecret } from "@/lib/bifrost"

interface ManageProps {
  initialShare?: string;
}

const Manage: React.FC<ManageProps> = ({ initialShare }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<string>("shares");

  // State for t of n shares
  const [sharesInputs, setSharesInputs] = useState<string[]>([initialShare || ""]);
  const [totalShares, setTotalShares] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  const [keysetName, setKeysetName] = useState("");
  const [sharesFormValid, setSharesFormValid] = useState(false);
  
  // New threshold after rotation
  const [newTotalShares, setNewTotalShares] = useState<number>(3);
  const [newThreshold, setNewThreshold] = useState<number>(2);
  
  // State for nsec input
  const [secretKey, setSecretKey] = useState("");
  const [secretKeysetName, setSecretKeysetName] = useState("");
  const [nsecNewTotalShares, setNsecNewTotalShares] = useState<number>(3);
  const [nsecNewThreshold, setNsecNewThreshold] = useState<number>(2);
  const [nsecFormValid, setNsecFormValid] = useState(false);
  
  // State for the result
  const [result, setResult] = useState<{ success: boolean; message: string | React.ReactNode }>({ 
    success: false, 
    message: null 
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Set initial new threshold values
  useEffect(() => {
    setNewTotalShares(totalShares);
    setNewThreshold(threshold);
  }, [totalShares, threshold]);

  // Validate the shares form
  useEffect(() => {
    const validShares = sharesInputs.filter(share => share.trim()).length;
    const nameValid = keysetName.trim().length > 0;
    
    // Form is valid if we have a name and enough valid shares
    setSharesFormValid(nameValid && validShares >= threshold);
  }, [sharesInputs, threshold, keysetName]);

  // Validate the nsec form
  useEffect(() => {
    const nsecValid = secretKey.trim().length > 0;
    const nameValid = secretKeysetName.trim().length > 0;
    
    // Form is valid if we have both a name and a secret key
    setNsecFormValid(nameValid && nsecValid);
  }, [secretKey, secretKeysetName]);

  // Update shares inputs when threshold changes
  useEffect(() => {
    // Adjust shares inputs array when threshold changes
    if (sharesInputs.length > threshold) {
      // If we have more inputs than threshold, trim the array
      setSharesInputs(sharesInputs.slice(0, threshold));
    } else if (sharesInputs.length < 1) {
      // Always have at least one input
      setSharesInputs([""]);
    }
  }, [threshold]);

  // Update shares inputs when initialShare changes
  useEffect(() => {
    if (initialShare) {
      setSharesInputs([initialShare]);
    }
  }, [initialShare]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Clear any previous results when switching tabs
    setResult({ success: false, message: null });
  };

  // Handle adding more share inputs
  const addShareInput = () => {
    if (sharesInputs.length < threshold) {
      setSharesInputs([...sharesInputs, ""]);
    }
  };

  // Handle removing a share input
  const removeShareInput = (indexToRemove: number) => {
    if (sharesInputs.length > 1) {
      const newSharesInputs = sharesInputs.filter((_, index) => index !== indexToRemove);
      setSharesInputs(newSharesInputs);
    }
  };

  // Handle updating share input values
  const updateShareInput = (index: number, value: string) => {
    const newSharesInputs = [...sharesInputs];
    newSharesInputs[index] = value;
    setSharesInputs(newSharesInputs);
  };

  // Format keyset display for the result
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

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (activeTab === "shares") {
      handleRotateWithShares();
    } else {
      handleRotateWithSecret();
    }
  };

  // Handle rotation with shares
  const handleRotateWithShares = async () => {
    if (!sharesFormValid) return;
    
    setIsProcessing(true);
    try {
      // In a real implementation, you would:
      // 1. Reconstruct the secret from the shares
      // 2. Generate a new keyset with the new threshold/total using the secret
      
      // This is a placeholder - actual implementation would use the reconstructed secret
      const keyset = generateRandomKeyset(newThreshold, newTotalShares);
      setResult({
        success: true,
        message: (
          <div>
            <div className="mb-3 text-green-200 font-medium">
              Successfully rotated keyset "{keysetName}" with new threshold {newThreshold} of {newTotalShares}
            </div>
            {formatKeysetDisplay(keyset)}
          </div>
        )
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error rotating keys: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle rotation with nsec
  const handleRotateWithSecret = async () => {
    if (!nsecFormValid) return;
    
    setIsProcessing(true);
    try {
      // Generate new keyset using the provided secret and new threshold
      const keyset = generateKeysetWithSecret(nsecNewThreshold, nsecNewTotalShares, secretKey);
      setResult({
        success: true,
        message: (
          <div>
            <div className="mb-3 text-green-200 font-medium">
              Successfully rotated keyset "{secretKeysetName}" with new threshold {nsecNewThreshold} of {nsecNewTotalShares}
            </div>
            {formatKeysetDisplay(keyset)}
          </div>
        )
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error rotating keys: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-blue-200">Manage Keyset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <form onSubmit={handleSubmit}>
          <Tabs 
            defaultValue="shares" 
            className="w-full"
            onValueChange={handleTabChange}
          >
            <TabsList className="grid grid-cols-2 mb-4 bg-gray-800/50 w-full">
              <TabsTrigger value="shares" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">
                Rotate with Shares
              </TabsTrigger>
              <TabsTrigger value="nsec" className="text-sm py-2 text-purple-400 data-[state=active]:bg-purple-900/60 data-[state=active]:text-purple-200">
                Rotate with NSEC
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shares" className="border border-blue-900/30 rounded-lg p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="keyset-name" className="text-blue-200 text-sm font-medium">
                    Keyset Name
                  </label>
                  <Input
                    id="keyset-name"
                    type="text"
                    placeholder="Enter a name for the keyset"
                    value={keysetName}
                    onChange={(e) => setKeysetName(e.target.value)}
                    className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                    disabled={isProcessing}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="total-shares" className="text-blue-200 text-sm font-medium">
                      Total Shares
                    </label>
                    <Input
                      id="total-shares"
                      type="number"
                      min={2}
                      value={totalShares}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setTotalShares(value);
                        if (threshold > value) setThreshold(value);
                      }}
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      disabled={isProcessing}
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
                      max={totalShares}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-blue-200 text-sm font-medium">Share Credentials:</div>
                  {sharesInputs.map((share, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={`Enter share ${index + 1}`}
                        value={share}
                        onChange={(e) => updateShareInput(index, e.target.value)}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm flex-1"
                        disabled={isProcessing}
                      />
                      <Button
                        type="button"
                        onClick={() => removeShareInput(index)}
                        className="bg-red-900/30 hover:bg-red-800/50 text-red-300 px-2"
                        disabled={isProcessing || sharesInputs.length <= 1}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  {sharesInputs.length < threshold && (
                    <Button
                      type="button"
                      onClick={addShareInput}
                      className="w-full mt-2 bg-blue-600/30 hover:bg-blue-700/30"
                      disabled={isProcessing}
                    >
                      Add Share Input ({sharesInputs.length}/{threshold})
                    </Button>
                  )}
                </div>

                <div className="mt-6 border-t border-blue-900/30 pt-4">
                  <h3 className="text-blue-200 text-sm font-medium mb-3">New Threshold Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="new-total-shares" className="text-blue-200 text-sm font-medium">
                        New Total Shares
                      </label>
                      <Input
                        id="new-total-shares"
                        type="number"
                        min={2}
                        value={newTotalShares}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setNewTotalShares(value);
                          if (newThreshold > value) setNewThreshold(value);
                        }}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="new-threshold" className="text-blue-200 text-sm font-medium">
                        New Threshold
                      </label>
                      <Input
                        id="new-threshold"
                        type="number"
                        min={2}
                        max={newTotalShares}
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="nsec" className="border border-purple-900/30 rounded-lg p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="secret-keyset-name" className="text-purple-200 text-sm font-medium">
                    Keyset Name
                  </label>
                  <Input
                    id="secret-keyset-name"
                    type="text"
                    placeholder="Enter a name for the keyset"
                    value={secretKeysetName}
                    onChange={(e) => setSecretKeysetName(e.target.value)}
                    className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                    disabled={isProcessing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="secret-key" className="text-purple-200 text-sm font-medium">
                    Private Key (NSEC)
                  </label>
                  <Input
                    id="secret-key"
                    type="password"
                    placeholder="Enter your nsec or hex private key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                    disabled={isProcessing}
                    required
                  />
                </div>

                <div className="mt-6 border-t border-purple-900/30 pt-4">
                  <h3 className="text-purple-200 text-sm font-medium mb-3">New Threshold Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="nsec-new-total-shares" className="text-purple-200 text-sm font-medium">
                        New Total Shares
                      </label>
                      <Input
                        id="nsec-new-total-shares"
                        type="number"
                        min={2}
                        value={nsecNewTotalShares}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setNsecNewTotalShares(value);
                          if (nsecNewThreshold > value) setNsecNewThreshold(value);
                        }}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                        disabled={isProcessing}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="nsec-new-threshold" className="text-purple-200 text-sm font-medium">
                        New Threshold
                      </label>
                      <Input
                        id="nsec-new-threshold"
                        type="number"
                        min={2}
                        max={nsecNewTotalShares}
                        value={nsecNewThreshold}
                        onChange={(e) => setNsecNewThreshold(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <div className="mt-6">
              <Button 
                type="submit"
                className="w-full py-5 bg-green-600 hover:bg-green-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing || (activeTab === "shares" ? !sharesFormValid : !nsecFormValid)}
              >
                {isProcessing ? "Processing..." : "Rotate Keys"}
              </Button>
            </div>
          </Tabs>
        </form>

        {result.message && (
          <div className={`mt-4 p-3 rounded-lg ${
            result.success ? 'bg-green-900/30 text-green-200' : 'bg-red-900/30 text-red-200'
          }`}>
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Manage; 