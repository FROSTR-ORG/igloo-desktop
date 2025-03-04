import React, { useState, useEffect, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { recover_nsec, decode_share, decode_group } from "@/lib/bifrost"

interface RecoverProps {
  initialShare?: string;
  initialGroupCredential?: string;
  threshold?: number;
  totalShares?: number;
}

const Recover: React.FC<RecoverProps> = ({ 
  initialShare,
  initialGroupCredential,
  threshold = 2,
  totalShares = 3
}) => {
  // State for t of n shares
  const [sharesInputs, setSharesInputs] = useState<string[]>([initialShare || ""]);
  const [groupCredential, setGroupCredential] = useState<string>(initialGroupCredential || "");
  const [sharesFormValid, setSharesFormValid] = useState(false);
  
  // State for the result
  const [result, setResult] = useState<{ success: boolean; message: string | React.ReactNode }>({ 
    success: false, 
    message: null 
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate the shares form
  useEffect(() => {
    const validShares = sharesInputs.filter(share => share.trim()).length;
    setSharesFormValid(validShares >= threshold && groupCredential.trim().length > 0);
  }, [sharesInputs, threshold, groupCredential]);

  // Update shares inputs when initialShare changes
  useEffect(() => {
    if (initialShare) {
      setSharesInputs([initialShare]);
    }
    if (initialGroupCredential) {
      setGroupCredential(initialGroupCredential);
    }
  }, [initialShare, initialGroupCredential]);

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

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!sharesFormValid) return;
    
    setIsProcessing(true);
    try {
      // Decode all shares
      const decodedShares = sharesInputs
        .filter(share => share.trim())
        .map(share => decode_share(share));

      // Decode the group credential
      const group = decode_group(groupCredential);

      // Recover the secret key
      const nsec = recover_nsec(group, decodedShares);

      setResult({
        success: true,
        message: (
          <div>
            <div className="mb-3 text-green-200 font-medium">
              Successfully recovered NSEC using {sharesInputs.length} shares
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1">Recovered NSEC:</div>
                <div className="bg-gray-800/50 p-2 rounded text-xs break-all">
                  {nsec}
                </div>
              </div>
            </div>
          </div>
        )
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: `Error recovering NSEC: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-blue-200">Recover NSEC</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-sm text-blue-300 mb-2">Recovery Requirements:</div>
              <div className="text-sm text-blue-200">
                You need {threshold} out of {totalShares} shares to recover your NSEC
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-blue-200 text-sm font-medium">Group Credential:</div>
              <Input
                type="text"
                placeholder="Enter group credential"
                value={groupCredential}
                onChange={(e) => setGroupCredential(e.target.value)}
                className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                disabled={isProcessing}
              />
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
          </div>

          <div className="mt-6">
            <Button 
              type="submit"
              className="w-full py-5 bg-green-600 hover:bg-green-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing || !sharesFormValid}
            >
              {isProcessing ? "Processing..." : "Recover NSEC"}
            </Button>
          </div>
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

export default Recover; 