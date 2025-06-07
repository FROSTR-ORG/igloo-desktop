import React, { useState, useEffect, FormEvent, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { recoverSecretKeyFromCredentials, decodeShare, decodeGroup, validateShare, validateGroup } from "@frostr/igloo-core"
import { InputWithValidation } from "@/components/ui/input-with-validation"
import { clientShareManager } from "@/lib/clientShareManager"
import { HelpCircle } from "lucide-react"

interface RecoverProps {
  initialShare?: string;
  initialGroupCredential?: string;
  defaultThreshold?: number;
  defaultTotalShares?: number;
}

// Enable debugging for troubleshooting group auto-population issues
const DEBUG_AUTO_POPULATE = true;

// Add utility function to find matching group at the component level
const findMatchingGroup = async (shareValue: string) => {
  if (!shareValue || !shareValue.trim()) return null;
  
  try {
    // Try to decode the share
    const decodedShare = decodeShare(shareValue);
    
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
              const savedDecodedShare = decodeShare(saved.shareCredential);
              return savedDecodedShare.binder_sn === decodedShare.binder_sn && saved.groupCredential;
            } catch {
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

// Add this helper function after the findMatchingGroup function
const decodeGroupThresholdAndShares = (
  groupCredential: string,
  defaultThreshold: number,
  defaultTotalShares: number,
  debugEnabled = DEBUG_AUTO_POPULATE
): { threshold: number; totalShares: number } => {
  try {
    const decodedGroup = decodeGroup(groupCredential);
    const threshold = decodedGroup?.threshold ?? defaultThreshold;
    const totalShares = (decodedGroup?.commits && Array.isArray(decodedGroup.commits)) 
                        ? decodedGroup.commits.length 
                        : defaultTotalShares;
    
    return { threshold, totalShares };
  } catch (error) {
    if (debugEnabled) {
      console.error("Error decoding group for threshold/totalShares:", error);
    }
    return { threshold: defaultThreshold, totalShares: defaultTotalShares };
  }
};

// Helper function to handle group credential processing and state updates
const processAndSetGroupCredential = (
  groupCredential: string,
  defaultThreshold: number,
  defaultTotalShares: number,
  options: {
    setGroupCredential: (value: string) => void;
    setIsGroupValid: (valid: boolean) => void;
    setGroupError: (error: string | undefined) => void;
    setCurrentThreshold: (threshold: number) => void;
    setCurrentTotalShares: (totalShares: number) => void;
    setIsGroupAutofilled?: (autofilled: boolean) => void;
    autofilledTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
    showAutofilled?: boolean;
  }
) => {
  const { 
    setGroupCredential, 
    setIsGroupValid, 
    setGroupError, 
    setCurrentThreshold, 
    setCurrentTotalShares,
    setIsGroupAutofilled,
    autofilledTimeoutRef,
    showAutofilled = false
  } = options;

  setGroupCredential(groupCredential);
  const validation = validateGroup(groupCredential);
  setIsGroupValid(validation.isValid);
  setGroupError(validation.message);
  
  // Decode group to set currentThreshold and currentTotalShares
  if (validation.isValid) {
    const { threshold, totalShares } = decodeGroupThresholdAndShares(
      groupCredential,
      defaultThreshold,
      defaultTotalShares
    );
    setCurrentThreshold(threshold);
    setCurrentTotalShares(totalShares);
  }

  // Show auto-detection indicator if requested
  if (showAutofilled && setIsGroupAutofilled && autofilledTimeoutRef) {
    setIsGroupAutofilled(true);
    if (autofilledTimeoutRef.current) {
      clearTimeout(autofilledTimeoutRef.current);
    }
    autofilledTimeoutRef.current = setTimeout(() => {
      setIsGroupAutofilled(false);
    }, 5000);
  }
};

const Recover: React.FC<RecoverProps> = ({ 
  initialShare,
  initialGroupCredential,
  defaultThreshold = 2,
  defaultTotalShares = 3
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

  // Add state for the dynamic threshold
  const [currentThreshold, setCurrentThreshold] = useState<number>(defaultThreshold);
  // Add state for dynamic total shares
  const [currentTotalShares, setCurrentTotalShares] = useState<number>(defaultTotalShares);

  // Helper function to process group credential and update state (within component scope)
  const processGroupCredential = useCallback((groupCred: string, showAutofilled = false) => {
    processAndSetGroupCredential(groupCred, defaultThreshold, defaultTotalShares, {
      setGroupCredential,
      setIsGroupValid,
      setGroupError,
      setCurrentThreshold,
      setCurrentTotalShares,
      setIsGroupAutofilled,
      autofilledTimeoutRef,
      showAutofilled
    });
  }, [defaultThreshold, defaultTotalShares]);

  // Validate the shares form
  useEffect(() => {
    const validSharesCount = sharesValidity.filter(validity => validity.isValid).length;
    setSharesFormValid(validSharesCount >= currentThreshold && isGroupValid);
  }, [sharesValidity, currentThreshold, isGroupValid]);

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
          processGroupCredential(matchingGroup, true);
        }
      };
      
      populateGroup();
    }
    
    // Handle initialGroupCredential if provided
    if (initialGroupCredential) {
      processGroupCredential(initialGroupCredential, false);
    }
  }, [initialShare, initialGroupCredential, defaultThreshold, defaultTotalShares, processGroupCredential]);

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
                processGroupCredential(firstValidShare.groupCredential, true);
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
  }, [defaultThreshold, defaultTotalShares, groupCredential, sharesInputs, processGroupCredential]);

  // Handle adding more share inputs
  const addShareInput = () => {
    if (sharesInputs.length < currentThreshold) {
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
        const decodedShare = decodeShare(value);
        
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
                processGroupCredential(matchingGroup, true);
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
      if (!validation.isValid) {
        setCurrentThreshold(defaultThreshold); // Revert to default if basic validation fails
        setCurrentTotalShares(defaultTotalShares); // Revert to default
      }
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
        const decodedGroup = decodeGroup(value);
        
        // Additional structure validation
        if (typeof decodedGroup.threshold !== 'number' || 
            typeof decodedGroup.group_pk !== 'string' || 
            !Array.isArray(decodedGroup.commits) ||
            decodedGroup.commits.length === 0) {
          setIsGroupValid(false);
          setGroupError('Group credential has invalid internal structure');
          setCurrentThreshold(defaultThreshold); // Revert to default if structure is bad
          setCurrentTotalShares(defaultTotalShares); // Revert to default
          return;
        }
        
        // Set the dynamic threshold
        setCurrentThreshold(decodedGroup.threshold);
        // Set dynamic total shares
        setCurrentTotalShares(decodedGroup.commits.length);
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
        setCurrentThreshold(defaultThreshold); // Revert to default on decode error
        setCurrentTotalShares(defaultTotalShares); // Revert to default
      }
    } else {
      setIsGroupValid(validation.isValid);
      setGroupError(validation.message);
      if (!validation.isValid) {
        setCurrentThreshold(defaultThreshold); // Revert to default if basic validation fails
        setCurrentTotalShares(defaultTotalShares); // Revert to default
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!sharesFormValid) return;
    
    setIsProcessing(true);
    try {
      // Get valid share credentials
      const validShareCredentials = sharesInputs
        .filter((_, index) => sharesValidity[index].isValid);

      // Recover the secret key using credentials directly
      const nsec = recoverSecretKeyFromCredentials(groupCredential, validShareCredentials);

              setResult({
          success: true,
          message: (
            <div>
              <div className="mb-3 text-green-200 font-medium">
                Successfully recovered NSEC using {validShareCredentials.length} shares
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
    } catch (error) {
      setResult({
        success: false,
        message: `Error recovering NSEC: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <div className="flex items-center">
          <CardTitle className="text-xl text-blue-200">Recover NSEC</CardTitle>
          <HelpCircle size={18} className="ml-2 text-blue-400" />
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-sm text-blue-300 mb-2">Recovery Requirements:</div>
              <div className="text-sm text-blue-200">
                You need {currentThreshold} out of {currentTotalShares} shares to recover your NSEC
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
              type="text"
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
              {sharesInputs.length < currentThreshold && (
                <Button
                  type="button"
                  onClick={addShareInput}
                  className="w-full mt-2 bg-blue-600/30 hover:bg-blue-700/30"
                  disabled={isProcessing}
                >
                  Add Share Input ({sharesInputs.length}/{currentThreshold})
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