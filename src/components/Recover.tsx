import React, { useState, useEffect, FormEvent, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { recover_nsec, decode_share, decode_group } from "@/lib/bifrost"
import { InputWithValidation } from "@/components/ui/input-with-validation"
import { validateShare, validateGroup } from "@/lib/validation"
import { clientShareManager, type IglooShare } from "@/lib/clientShareManager"

interface RecoverProps {
  initialShare?: string;
  initialGroupCredential?: string;
  threshold?: number;
  totalShares?: number;
}

// Enable debugging for troubleshooting group auto-population issues
const DEBUG_AUTO_POPULATE = true;

// Add utility function to find matching group at the component level
const findMatchingGroup = async (shareValue: string) => {
  if (!shareValue || !shareValue.trim()) return null;
  
  try {
    // Try to decode the share
    const decodedShare = decode_share(shareValue);
    
    if (DEBUG_AUTO_POPULATE) {
      console.log("Share decoded for group lookup:", decodedShare);
    }
    
    // Check if we can find a matching share with a group
    if (decodedShare && decodedShare.binder_sn) {
      const shares = await clientShareManager.getShares();
      if (shares && Array.isArray(shares)) {
        // Look for any share with matching binder_sn and a group credential
        const matchingShare = shares.find(saved => {
          // Match by metadata
          if (saved.metadata && saved.metadata.binder_sn === decodedShare.binder_sn) {
            return saved.groupCredential;
          }
          
          // Match by share content if it's already decoded
          if (saved.shareCredential) {
            try {
              const savedDecodedShare = decode_share(saved.shareCredential);
              return savedDecodedShare.binder_sn === decodedShare.binder_sn && saved.groupCredential;
            } catch (e) {
              // Skip this check if we can't decode
            }
          }
          
          // Check ID for partial match (first 8 chars of binder_sn)
          if (saved.id && decodedShare.binder_sn) {
            const binderPrefix = decodedShare.binder_sn.substring(0, 8);
            return saved.id.includes(binderPrefix) && saved.groupCredential;
          }
          
          return false;
        });
        
        if (matchingShare && matchingShare.groupCredential) {
          if (DEBUG_AUTO_POPULATE) {
            console.log("Found matching group:", matchingShare.groupCredential);
          }
          return matchingShare.groupCredential;
        }
      }
    }
  } catch (error) {
    if (DEBUG_AUTO_POPULATE) {
      console.error("Error finding matching group:", error);
    }
  }
  
  return null;
};

const Recover: React.FC<RecoverProps> = ({ 
  initialShare,
  initialGroupCredential,
  threshold = 2,
  totalShares = 3
}) => {
  // State for t of n shares
  const [sharesInputs, setSharesInputs] = useState<string[]>([initialShare || ""]);
  const [sharesValidity, setSharesValidity] = useState<{ isValid: boolean; message?: string }[]>([{ isValid: false }]);
  
  const [groupCredential, setGroupCredential] = useState<string>(initialGroupCredential || "");
  const [isGroupValid, setIsGroupValid] = useState(false);
  const [groupError, setGroupError] = useState<string | undefined>(undefined);
  
  // Add state for tracking if the group was auto-populated
  const [isGroupAutofilled, setIsGroupAutofilled] = useState(false);
  
  // Add a timeout ref to clear the autofilled indicator
  const autofilledTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [sharesFormValid, setSharesFormValid] = useState(false);
  
  // State for the result
  const [result, setResult] = useState<{ success: boolean; message: string | React.ReactNode }>({ 
    success: false, 
    message: null 
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate the shares form
  useEffect(() => {
    const validSharesCount = sharesValidity.filter(validity => validity.isValid).length;
    setSharesFormValid(validSharesCount >= threshold && isGroupValid);
  }, [sharesValidity, threshold, isGroupValid]);

  // Add useEffect to check for initialShare changes and extract from it
  useEffect(() => {
    if (initialShare) {
      // Update the share input UI
      setSharesInputs([initialShare]);
      const validation = validateShare(initialShare);
      setSharesValidity([validation]);
      
      // Use the utility function to find matching group
      const populateGroup = async () => {
        const matchingGroup = await findMatchingGroup(initialShare);
        
        if (matchingGroup) {
          setGroupCredential(matchingGroup);
          const validation = validateGroup(matchingGroup);
          setIsGroupValid(validation.isValid);
          setGroupError(validation.message);
          
          // Show auto-detection indicator
          setIsGroupAutofilled(true);
          if (autofilledTimeoutRef.current) {
            clearTimeout(autofilledTimeoutRef.current);
          }
          autofilledTimeoutRef.current = setTimeout(() => {
            setIsGroupAutofilled(false);
          }, 5000);
        }
      };
      
      populateGroup();
    }
    
    // Handle initialGroupCredential if provided
    if (initialGroupCredential) {
      setGroupCredential(initialGroupCredential);
      const validation = validateGroup(initialGroupCredential);
      setIsGroupValid(validation.isValid);
      setGroupError(validation.message);
    }
  }, [initialShare, initialGroupCredential]);

  // Add useEffect to check for stored shares on component mount
  useEffect(() => {
    const autoDetectGroupFromStorage = async () => {
      // If we already have shares or group, no need to auto-detect
      if (sharesInputs.some(s => s.trim()) || groupCredential.trim()) {
        return;
      }
      
      try {
        // Try to find a recent share with group information
        const shares = await clientShareManager.getShares();
        
        if (DEBUG_AUTO_POPULATE) {
          console.log("Checking for stored shares on mount:", Array.isArray(shares) ? shares.length : 0);
        }
        
        if (shares && Array.isArray(shares) && shares.length > 0) {
          // Sort by savedAt date if available
          const sortedShares = [...shares].sort((a, b) => {
            if (a.savedAt && b.savedAt) {
              return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
            }
            return 0;
          });
          
          // Find the most recent share with both group and share
          const firstValidShare = sortedShares.find(s => 
            s.shareCredential && s.shareCredential.trim() && 
            s.groupCredential && s.groupCredential.trim()
          );
          
          if (firstValidShare) {
            if (DEBUG_AUTO_POPULATE) {
              console.log("Found recent share with group on mount:", firstValidShare.id);
            }
            
            // Set the share
            if (firstValidShare.shareCredential) {
              const shareValidation = validateShare(firstValidShare.shareCredential);
              if (shareValidation.isValid) {
                setSharesInputs([firstValidShare.shareCredential]);
                setSharesValidity([shareValidation]);
              }
            }
            
            // Set the group
            if (firstValidShare.groupCredential) {
              const groupValidation = validateGroup(firstValidShare.groupCredential);
              if (groupValidation.isValid) {
                setGroupCredential(firstValidShare.groupCredential);
                setIsGroupValid(groupValidation.isValid);
                setGroupError(groupValidation.message);
                
                // Show auto-detection indicator
                setIsGroupAutofilled(true);
                if (autofilledTimeoutRef.current) {
                  clearTimeout(autofilledTimeoutRef.current);
                }
                autofilledTimeoutRef.current = setTimeout(() => {
                  setIsGroupAutofilled(false);
                }, 5000);
              }
            }
          }
        }
      } catch (error) {
        if (DEBUG_AUTO_POPULATE) {
          console.error("Error auto-detecting share/group on mount:", error);
        }
      }
    };
    
    autoDetectGroupFromStorage();
  }, []); // Run once on mount

  // Handle adding more share inputs
  const addShareInput = () => {
    if (sharesInputs.length < totalShares) {
      setSharesInputs([...sharesInputs, ""]);
      setSharesValidity([...sharesValidity, { isValid: false }]);
    }
  };

  // Handle removing a share input
  const removeShareInput = (indexToRemove: number) => {
    if (sharesInputs.length > 1) {
      const newSharesInputs = sharesInputs.filter((_, index) => index !== indexToRemove);
      const newSharesValidity = sharesValidity.filter((_, index) => index !== indexToRemove);
      setSharesInputs(newSharesInputs);
      setSharesValidity(newSharesValidity);
    }
  };

  // Handle updating share input values
  const updateShareInput = (index: number, value: string) => {
    const newSharesInputs = [...sharesInputs];
    newSharesInputs[index] = value;
    setSharesInputs(newSharesInputs);
    
    const validation = validateShare(value);
    
    // Additional validation - try to decode with bifrost if the basic validation passes
    if (validation.isValid && value.trim()) {
      try {
        // If this doesn't throw, it's a valid share
        const decodedShare = decode_share(value);
        
        if (DEBUG_AUTO_POPULATE) {
          console.log(`Decoded share ${index}:`, decodedShare);
        }
        
        // Additional structure validation
        if (typeof decodedShare.idx !== 'number' || 
            typeof decodedShare.seckey !== 'string' || 
            typeof decodedShare.binder_sn !== 'string' || 
            typeof decodedShare.hidden_sn !== 'string') {
          const newSharesValidity = [...sharesValidity];
          newSharesValidity[index] = { 
            isValid: false, 
            message: 'Share has invalid internal structure' 
          };
          setSharesValidity(newSharesValidity);
          return;
        }
        
        // Auto-populate group if not already set
        if (!groupCredential.trim()) {
          // Use the utility function for group lookup
          findMatchingGroup(value).then(matchingGroup => {
            if (matchingGroup) {
              // Validate group before using
              const groupValid = validateGroup(matchingGroup);
              if (groupValid.isValid) {
                setGroupCredential(matchingGroup);
                setIsGroupValid(true);
                setGroupError(undefined);
                
                // Show auto-detection indicator
                setIsGroupAutofilled(true);
                if (autofilledTimeoutRef.current) {
                  clearTimeout(autofilledTimeoutRef.current);
                }
                autofilledTimeoutRef.current = setTimeout(() => {
                  setIsGroupAutofilled(false);
                }, 5000);
              }
            }
          });
        }
        
        // Update share validity
        const newSharesValidity = [...sharesValidity];
        newSharesValidity[index] = validation;
        setSharesValidity(newSharesValidity);
      } catch (error) {
        if (DEBUG_AUTO_POPULATE) {
          console.error("Error decoding share:", error);
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Invalid share structure';
        const newSharesValidity = [...sharesValidity];
        newSharesValidity[index] = { isValid: false, message: errorMessage };
        setSharesValidity(newSharesValidity);
      }
    } else {
      const newSharesValidity = [...sharesValidity];
      newSharesValidity[index] = validation;
      setSharesValidity(newSharesValidity);
    }
  };

  // Handle group credential change
  const handleGroupChange = (value: string) => {
    setGroupCredential(value);
    setIsGroupAutofilled(false); // Clear the autofilled flag when user types
    
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

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!sharesFormValid) return;
    
    setIsProcessing(true);
    try {
      // Decode all shares
      const decodedShares = sharesInputs
        .filter((_, index) => sharesValidity[index].isValid)
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
              Successfully recovered NSEC using {decodedShares.length} shares
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

            <InputWithValidation
              label={
                <div className="flex items-center">
                  <span>Group Credential</span>
                  {isGroupAutofilled && (
                    <span className="ml-2 text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                      Auto-detected
                    </span>
                  )}
                </div>
              }
              type="password"
              placeholder="Enter bfgroup1... credential"
              value={groupCredential}
              onChange={handleGroupChange}
              isValid={isGroupValid}
              errorMessage={groupError}
              isRequired={true}
              className="w-full"
            />

            <div className="space-y-3 w-full">
              <div className="text-blue-200 text-sm font-medium">Share Credentials:</div>
              {sharesInputs.map((share, index) => (
                <div key={index} className="flex gap-2 w-full">
                  <InputWithValidation
                    placeholder={`Enter share ${index + 1} (bfshare1...)`}
                    value={share}
                    onChange={(value) => updateShareInput(index, value)}
                    isValid={sharesValidity[index]?.isValid}
                    errorMessage={sharesValidity[index]?.message}
                    className="flex-1 w-full"
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