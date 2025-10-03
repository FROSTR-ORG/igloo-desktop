import React, { useState, useEffect, useCallback } from 'react';
import { validateGroup, decodeGroup, validateShare, decodeShare } from '@frostr/igloo-core';
import { bytesToHex } from '@noble/hashes/utils';
import { derive_secret_async, encrypt_payload, CURRENT_SHARE_VERSION } from '@/lib/encryption';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { clientShareManager } from '@/lib/clientShareManager';
import type { DecodedGroup, DecodedShare, IglooShare } from '@/types';

interface AddShareProps {
  onComplete: () => void;
  onCancel: () => void;
}

type Step = 'group' | 'share' | 'save';

const normalizeShareIdentifier = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const AddShare: React.FC<AddShareProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<Step>('group');
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1: Group credential
  const [groupCredential, setGroupCredential] = useState('');
  const [isGroupValid, setIsGroupValid] = useState(false);
  const [groupError, setGroupError] = useState<string | undefined>(undefined);
  const [decodedGroup, setDecodedGroup] = useState<DecodedGroup | null>(null);

  // Step 2: Share credential
  const [shareCredential, setShareCredential] = useState('');
  const [isShareValid, setIsShareValid] = useState(false);
  const [shareError, setShareError] = useState<string | undefined>(undefined);
  const [decodedShare, setDecodedShare] = useState<DecodedShare | null>(null);

  // Step 3: Password and name
  const [shareName, setShareName] = useState('');
  const [isNameValid, setIsNameValid] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isConfirmValid, setIsConfirmValid] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [existingNameKeys, setExistingNameKeys] = useState<string[]>([]);

  useEffect(() => {
    const loadExistingNames = async () => {
      const shares = await clientShareManager.getShares();
      if (shares) {
        const normalizedNames = Array.from(
          new Set(
            shares
              .map(share => normalizeShareIdentifier(share.name))
              .filter(name => name.length > 0)
          )
        );
        setExistingNameKeys(normalizedNames);
      }
    };
    loadExistingNames();
  }, []);

  const evaluateShareName = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setIsNameValid(false);
        setNameError('Share name is required');
        return false;
      }

      const normalizedValue = normalizeShareIdentifier(value);

      if (existingNameKeys.includes(normalizedValue)) {
        setIsNameValid(false);
        setNameError('A share with this name already exists');
        return false;
      }

      setIsNameValid(true);
      setNameError(undefined);
      return true;
    },
    [existingNameKeys]
  );

  useEffect(() => {
    if (!shareName.trim()) {
      return;
    }

    evaluateShareName(shareName);
  }, [evaluateShareName, shareName]);

  const handleGroupChange = (value: string) => {
    setGroupCredential(value);

    if (!value.trim()) {
      setIsGroupValid(false);
      setGroupError('Group credential is required');
      setDecodedGroup(null);
      return;
    }

    const validation = validateGroup(value);
    if (!validation.isValid) {
      setIsGroupValid(false);
      setGroupError(validation.message || 'Invalid group credential');
      setDecodedGroup(null);
      return;
    }

    try {
      const decoded = decodeGroup(value);
      setDecodedGroup(decoded);
      setIsGroupValid(true);
      setGroupError(undefined);
    } catch (error) {
      setIsGroupValid(false);
      setGroupError('Failed to decode group: ' + (error instanceof Error ? error.message : String(error)));
      setDecodedGroup(null);
    }
  };

  const handleShareChange = (value: string) => {
    setShareCredential(value);

    if (!value.trim()) {
      setIsShareValid(false);
      setShareError('Share credential is required');
      setDecodedShare(null);
      return;
    }

    const validation = validateShare(value);
    if (!validation.isValid) {
      setIsShareValid(false);
      setShareError(validation.message || 'Invalid share credential');
      setDecodedShare(null);
      return;
    }

    try {
      const decoded = decodeShare(value);
      setDecodedShare(decoded);

      // Verify share belongs to the group
      if (decodedGroup) {
        const shareIndex = decoded.idx;
        const validIndices = decodedGroup.commits.map(c => c.idx);

        if (!validIndices.includes(shareIndex)) {
          setIsShareValid(false);
          setShareError(`Share index ${shareIndex} does not belong to this group (valid indices: ${validIndices.join(', ')})`);
          return;
        }

        // Auto-populate share name based on index
        const suggestedName = `share ${shareIndex}`;
        if (!shareName) {
          setShareName(suggestedName);
          evaluateShareName(suggestedName);
        }
      }

      setIsShareValid(true);
      setShareError(undefined);
    } catch (error) {
      setIsShareValid(false);
      setShareError('Failed to decode share: ' + (error instanceof Error ? error.message : String(error)));
      setDecodedShare(null);
    }
  };

  const handleNameChange = (value: string) => {
    setShareName(value);
    evaluateShareName(value);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (!value.trim()) {
      setIsPasswordValid(false);
      setPasswordError('Password is required');
    } else if (value.length < 8) {
      setIsPasswordValid(false);
      setPasswordError('Password must be at least 8 characters');
    } else {
      setIsPasswordValid(true);
      setPasswordError(undefined);
    }

    if (confirmPassword) {
      validateConfirmPassword(value, confirmPassword);
    }
  };

  const validateConfirmPassword = (pass: string, confirm: string) => {
    if (!confirm.trim()) {
      setIsConfirmValid(false);
      setConfirmError('Confirm password is required');
    } else if (pass !== confirm) {
      setIsConfirmValid(false);
      setConfirmError('Passwords do not match');
    } else {
      setIsConfirmValid(true);
      setConfirmError(undefined);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    validateConfirmPassword(password, value);
  };

  const generateSalt = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return bytesToHex(array);
  };

  const isGroupComplete = Boolean(decodedGroup);
  const isShareComplete = Boolean(decodedShare && decodedGroup);
  const getStepTextClass = (step: Step, isComplete: boolean) => {
    if (currentStep === step) {
      return 'text-blue-200';
    }

    if (isComplete) {
      return 'text-blue-300';
    }

    return 'text-blue-400/60';
  };

  const getStepCircleClass = (step: Step, isComplete: boolean) => {
    if (currentStep === step) {
      return 'bg-blue-600 text-blue-100';
    }

    if (isComplete) {
      return 'bg-green-500/80 text-blue-950';
    }

    return 'bg-blue-900/40 border border-blue-900/50 text-blue-300';
  };

  const getConnectorClass = (isActive: boolean) =>
    isActive ? 'bg-blue-900/60' : 'bg-blue-900/30';

  const handleNextStep = () => {
    if (currentStep === 'group' && isGroupValid) {
      setCurrentStep('share');
    } else if (currentStep === 'share' && isShareValid) {
      setCurrentStep('save');
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'share') {
      setCurrentStep('group');
    } else if (currentStep === 'save') {
      setCurrentStep('share');
    }
  };

  const handleSave = async () => {
    if (!isPasswordValid || !isConfirmValid || !shareCredential || !decodedShare || !decodedGroup || !isNameValid) {
      return;
    }

    setIsProcessing(true);
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    try {
      const salt = generateSalt();
      const secret = await derive_secret_async(password, salt);
      const encryptedShare = encrypt_payload(secret, shareCredential);

      // Generate ID in format matching Create flow: name_share_index
      const shareId = normalizeShareIdentifier(shareName);

      const newShare: IglooShare = {
        id: shareId,
        name: shareName,
        share: encryptedShare,
        salt,
        groupCredential,
        version: CURRENT_SHARE_VERSION,
        savedAt: new Date().toISOString(),
        metadata: {
          binder_sn: decodedShare.binder_sn,
        },
        policy: {
          defaults: {
            allowSend: true,
            allowReceive: true,
          },
          updatedAt: new Date().toISOString(),
        },
      };

      const success = await clientShareManager.saveShare(newShare);

      if (success) {
        onComplete();
      } else {
        setPasswordError('Failed to save share to disk');
      }
    } catch (err) {
      setPasswordError('Failed to encrypt share: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-blue-200">Add</CardTitle>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className={`flex items-center gap-2 ${getStepTextClass('group', isGroupComplete)}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepCircleClass('group', isGroupComplete)}`}>
              {decodedGroup ? <Check className="w-4 h-4 text-blue-950" /> : '1'}
            </div>
            <span className="text-sm">Group</span>
          </div>
          <div className={`flex-1 h-px ${getConnectorClass(isGroupComplete || currentStep !== 'group')}`} />
          <div className={`flex items-center gap-2 ${getStepTextClass('share', isShareComplete)}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepCircleClass('share', isShareComplete)}`}>
              {decodedShare && currentStep !== 'share' ? <Check className="w-4 h-4 text-blue-950" /> : '2'}
            </div>
            <span className="text-sm">Share</span>
          </div>
          <div className={`flex-1 h-px ${getConnectorClass(isShareComplete || currentStep === 'save')}`} />
          <div className={`flex items-center gap-2 ${getStepTextClass('save', currentStep === 'save')}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepCircleClass('save', currentStep === 'save')}`}>
              3
            </div>
            <span className="text-sm">Save</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentStep === 'group' && (
          <div className="space-y-4">
            <p className="text-sm text-blue-100">
              Paste your group credential (bfgroup...) to see the keyset details.
            </p>
            <InputWithValidation
              label="Group Credential"
              type="text"
              value={groupCredential}
              onChange={handleGroupChange}
              isValid={isGroupValid}
              errorMessage={groupError}
              placeholder="bfgroup..."
              className="bg-blue-950/40 border-blue-900/50 text-blue-100 placeholder:text-blue-400/60 w-full font-mono text-xs"
              isRequired={true}
              disabled={isProcessing}
            />

            {decodedGroup && (
              <div className="bg-blue-950/40 border border-blue-900/40 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-blue-300">Group Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-200">Threshold:</span>
                    <span className="ml-2 text-blue-100">{decodedGroup.threshold}</span>
                  </div>
                  <div>
                    <span className="text-blue-200">Total Shares:</span>
                    <span className="ml-2 text-blue-100">{decodedGroup.commits.length}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-blue-200">Share Indices</h4>
                  <div className="flex flex-wrap gap-2">
                    {decodedGroup.commits.map(commit => (
                      <div key={commit.idx} className="bg-blue-900/40 border border-blue-900/30 px-3 py-1 rounded text-xs text-blue-100">
                        {commit.idx}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleNextStep}
                disabled={!isGroupValid || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'share' && (
          <div className="space-y-4">
            <p className="text-sm text-blue-100">
              Paste one share credential (bfshare...) that belongs to this group.
            </p>
            <InputWithValidation
              label="Share Credential"
              type="text"
              value={shareCredential}
              onChange={handleShareChange}
              isValid={isShareValid}
              errorMessage={shareError}
              placeholder="bfshare..."
              className="bg-blue-950/40 border-blue-900/50 text-blue-100 placeholder:text-blue-400/60 w-full font-mono text-xs"
              isRequired={true}
              disabled={isProcessing}
            />

            {decodedShare && decodedGroup && (
              <div className="bg-blue-950/40 border border-blue-900/40 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-blue-300">Share Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-200">Index:</span>
                    <span className="ml-2 text-blue-100">{decodedShare.idx}</span>
                  </div>
                  <div>
                    <span className="text-blue-200">Binder Serial:</span>
                    <span className="ml-2 text-blue-100 text-xs font-mono">{decodedShare.binder_sn.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                onClick={handlePreviousStep}
                variant="outline"
                disabled={isProcessing}
                className="border-blue-900/40 bg-blue-950/40 text-blue-200 hover:bg-blue-900/40 hover:text-blue-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={!isShareValid || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'save' && (
          <div className="relative space-y-4">
            {isProcessing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-blue-950/70 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
                <span className="text-sm font-medium text-blue-200">Encrypting and saving share…</span>
              </div>
            )}

            <p className="text-sm text-blue-100">
              Provide a name and password to encrypt and save this share.
            </p>

            <InputWithValidation
              label="Share Name"
              type="text"
              value={shareName}
              onChange={handleNameChange}
              isValid={isNameValid}
              errorMessage={nameError}
              placeholder="e.g., share 1"
              className="bg-blue-950/40 border-blue-900/50 text-blue-100 placeholder:text-blue-400/60 w-full"
              isRequired={true}
              disabled={isProcessing}
            />

            <InputWithValidation
              label="Password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              isValid={isPasswordValid}
              errorMessage={passwordError}
              placeholder="Enter password to encrypt this share"
              className="bg-blue-950/40 border-blue-900/50 text-blue-100 placeholder:text-blue-400/60 w-full"
              isRequired={true}
              disabled={isProcessing}
            />

            <InputWithValidation
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              isValid={isConfirmValid}
              errorMessage={confirmError}
              placeholder="Confirm password"
              className="bg-blue-950/40 border-blue-900/50 text-blue-100 placeholder:text-blue-400/60 w-full"
              isRequired={true}
              disabled={isProcessing}
            />

            <div className="flex justify-between">
              <Button
                onClick={handlePreviousStep}
                variant="outline"
                disabled={isProcessing}
                className="border-blue-900/40 bg-blue-950/40 text-blue-200 hover:bg-blue-900/40 hover:text-blue-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isPasswordValid || !isConfirmValid || !isNameValid || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding…
                  </>
                ) : (
                  'Add'
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AddShare;
