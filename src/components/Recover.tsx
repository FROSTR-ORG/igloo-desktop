import React, { useState, useEffect, FormEvent, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { recoverSecretKeyFromCredentials, decodeShare, decodeGroup, validateShare, validateGroup } from "@frostr/igloo-core"
import { InputWithValidation } from "@/components/ui/input-with-validation"
import { Tooltip } from "@/components/ui/tooltip"
import { clientShareManager } from "@/lib/clientShareManager"
import { HelpCircle, Copy, Check, Eye, EyeOff, AlertTriangle } from "lucide-react"
import { VALIDATION_LIMITS } from "@/lib/validation"

interface RecoverProps {
  initialShare?: string;
  initialGroupCredential?: string;
  defaultThreshold?: number;
  defaultTotalShares?: number;
  mode?: "standalone" | "preloaded";
}

// Debug helper for group auto-population
// SECURITY: Set to true locally for debugging (do not commit as true)
const DEBUG_AUTO_POPULATE = false;

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
  defaultTotalShares = 3,
  mode = "preloaded"
}) => {
  const isStandalone = mode === "standalone";
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

  // SECURITY: State for secure NSEC display
  // The NSEC is stored separately and NEVER rendered directly in the DOM unless explicitly revealed
  const [recoveredNsec, setRecoveredNsec] = useState<string | null>(null);
  const [isNsecRevealed, setIsNsecRevealed] = useState(false);
  const [isNsecCopied, setIsNsecCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const nsecClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Auto-clear NSEC from memory after 60 seconds for security
  const NSEC_AUTO_CLEAR_MS = 60000;

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
    // Skip auto-population in standalone mode
    if (isStandalone) {
      return;
    }

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
  }, [initialShare, initialGroupCredential, defaultThreshold, defaultTotalShares, processGroupCredential, isStandalone]);

  // Add useEffect to check for stored shares on component mount
  useEffect(() => {
    // Skip auto-detection in standalone mode
    if (isStandalone) {
      return;
    }

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
  }, [defaultThreshold, defaultTotalShares, groupCredential, sharesInputs, processGroupCredential, isStandalone]);

  // Handle adding more share inputs
  const addShareInput = () => {
    // Validate currentThreshold is a valid positive integer within bounds
    if (
      typeof currentThreshold !== 'number' ||
      !Number.isInteger(currentThreshold) ||
      currentThreshold < VALIDATION_LIMITS.THRESHOLD_MIN ||
      currentThreshold > VALIDATION_LIMITS.THRESHOLD_MAX
    ) {
      // Invalid threshold - don't allow adding more inputs
      return;
    }

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
    if (validation.isValid && value.trim().length > 0) {
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
        
        // Auto-populate group if not already set (skip in standalone mode)
        if (!isStandalone && !groupCredential.trim()) {
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

  // SECURITY: Clear NSEC from memory and reset related state
  const clearRecoveredNsec = useCallback(() => {
    setRecoveredNsec(null);
    setIsNsecRevealed(false);
    setIsNsecCopied(false);
    setCopyError(null);
    if (nsecClearTimeoutRef.current) {
      clearTimeout(nsecClearTimeoutRef.current);
      nsecClearTimeoutRef.current = null;
    }
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
    if (copyErrorTimeoutRef.current) {
      clearTimeout(copyErrorTimeoutRef.current);
      copyErrorTimeoutRef.current = null;
    }
  }, []);

  // SECURITY: Copy NSEC to clipboard without displaying it
  const handleCopyNsec = useCallback(async () => {
    if (!recoveredNsec) return;
    // Clear any previous error
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(recoveredNsec);
      setIsNsecCopied(true);
      // Clear any existing timeout before setting a new one
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      // Reset copied state after 2 seconds
      copiedTimeoutRef.current = setTimeout(() => setIsNsecCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy NSEC:', err);
      // Reset success state on failure to prevent contradictory UI
      setIsNsecCopied(false);
      // Show error feedback to user
      setCopyError('Failed to copy. Please reveal and copy manually.');
      // Clear any existing error timeout
      if (copyErrorTimeoutRef.current) {
        clearTimeout(copyErrorTimeoutRef.current);
      }
      // Auto-clear error after 5 seconds
      copyErrorTimeoutRef.current = setTimeout(() => setCopyError(null), 5000);
    }
  }, [recoveredNsec]);

  // SECURITY: Toggle NSEC visibility with warning
  const handleToggleNsecReveal = useCallback(() => {
    setIsNsecRevealed(prev => !prev);
  }, []);

  // Cleanup timeouts on unmount
  // Note: Accessing .current in cleanup is intentional for timeout refs -
  // we want to clear whatever timeout is active at unmount time.
  useEffect(() => {
    return () => {
      if (nsecClearTimeoutRef.current) clearTimeout(nsecClearTimeoutRef.current);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (copyErrorTimeoutRef.current) clearTimeout(copyErrorTimeoutRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (autofilledTimeoutRef.current) clearTimeout(autofilledTimeoutRef.current);
    };
  }, []);

  // Handle group credential change
  const handleGroupChange = (value: string) => {
    setGroupCredential(value);
    setIsGroupAutofilled(false); // Clear the autofilled flag when user types
    
    const validation = validateGroup(value);
    
    // Try deeper validation with bifrost decoder if basic validation passes
    if (validation.isValid && value.trim().length > 0) {
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

      // SECURITY: Store NSEC in state but don't render it directly
      // Clear any previous NSEC first
      clearRecoveredNsec();

      // Store the recovered NSEC securely in state
      setRecoveredNsec(nsec);
      setIsNsecRevealed(false);
      setIsNsecCopied(false);

      // Set up auto-clear timeout for security
      nsecClearTimeoutRef.current = setTimeout(() => {
        clearRecoveredNsec();
        setResult({
          success: true,
          message: 'NSEC has been cleared from memory for security. Recover again if needed.'
        });
      }, NSEC_AUTO_CLEAR_MS);

      setResult({
        success: true,
        message: `Successfully recovered NSEC using ${validShareCredentials.length} shares`
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
    <div className="space-y-6">
      {!isStandalone && (
        <div className="flex items-center mt-6">
          <h2 className="text-blue-300 text-lg">Recover NSEC</h2>
          <Tooltip
            trigger={<HelpCircle size={18} className="ml-2 text-blue-400 cursor-pointer" />}
            position="right"
            content={
              <>
                <p className="mb-2 font-semibold">NSEC Recovery:</p>
                <p className="mb-2">You need to input the threshold number of shares to recover your Nostr private key (nsec). For example, if your keyset was created with a 2-of-3 setup, you need any 2 of the 3 shares.</p>
                <p className="mb-2">One share has already been loaded from your current signer session and added to the form below.</p>
                <p>Once you have enough valid shares, click &quot;Recover NSEC&quot; to reconstruct your private key.</p>
              </>
            }
          />
        </div>
      )}

      {isStandalone && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-4">
          <h3 className="text-blue-300 font-medium mb-2">How to Recover</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-200">
            <li>Paste your group credential (bfgroup...) below</li>
            <li>The threshold will be automatically detected from your group</li>
            <li>Enter the required number of share credentials</li>
            <li>Click &quot;Recover NSEC&quot; to reconstruct your private key</li>
          </ol>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {(!isStandalone || isGroupValid) && (
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-sm text-blue-300 mb-2">Recovery Requirements:</div>
              <div className="text-sm text-blue-200">
                You need {currentThreshold} out of {currentTotalShares} shares to recover your NSEC
              </div>
            </div>
          )}

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

          {(!isStandalone || isGroupValid) && (
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
                    isRequired={true}
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
          )}
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

      {/* SECURITY: Secure NSEC display - never shows key in DOM by default */}
      {recoveredNsec && (
        <div className="mt-4 p-4 rounded-lg bg-gray-800/50 border border-green-700/50">
          {/* Security warning */}
          <div className="flex items-start gap-2 mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <div className="font-medium mb-1">Security Warning</div>
              <ul className="list-disc list-inside space-y-1 text-yellow-300/80">
                <li>Your private key will auto-clear in 60 seconds</li>
                <li>Do not screenshot or share this key</li>
                <li>Copy to a secure password manager</li>
              </ul>
            </div>
          </div>

          {/* NSEC display area */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-green-300">Recovered NSEC:</div>

            {/* Masked/Revealed key display */}
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
              {isNsecRevealed ? (
                <div className="text-xs font-mono break-all text-green-200">
                  {recoveredNsec}
                </div>
              ) : (
                <div className="text-xs font-mono text-gray-400">
                  {recoveredNsec.substring(0, 8)}{'•'.repeat(40)}...
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleCopyNsec}
                  className={`flex-1 text-sm ${copyError ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isNsecCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>

              <Button
                type="button"
                onClick={handleToggleNsecReveal}
                variant="outline"
                className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-sm"
              >
                {isNsecRevealed ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Reveal
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={clearRecoveredNsec}
                variant="outline"
                className="bg-red-900/30 hover:bg-red-800/50 border-red-700/50 text-red-300 text-sm"
              >
                Clear
              </Button>
              </div>

              {/* Copy error feedback */}
              {copyError && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
                  {copyError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recover;