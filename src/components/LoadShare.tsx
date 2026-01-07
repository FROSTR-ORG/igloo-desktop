import React, { useState, useRef, useEffect } from 'react';
import {
  derive_secret_async,
  decrypt_payload,
  PBKDF2_ITERATIONS_DEFAULT,
  PBKDF2_ITERATIONS_LEGACY,
  PBKDF2_ITERATIONS_V1,
  CURRENT_SHARE_VERSION
} from '@/lib/encryption';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { SharePolicy } from '@/types';
import { VALIDATION_LIMITS } from '@/lib/validation';

interface LoadShareProps {
  share: {
    id: string;
    name: string;
    encryptedShare: string;
    salt: string;
    groupCredential: string;
    version?: number;
    policy?: SharePolicy;
  };
  onLoad?: (decryptedShare: string, groupCredential: string) => void;
  onCancel?: () => void;
}

const LoadShare: React.FC<LoadShareProps> = ({ share, onLoad, onCancel }) => {
  const [password, setPassword] = useState<string>('');
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Ensure ref is true while mounted; React 18 StrictMode will invoke cleanup immediately after first setup
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    // No strict length validation - this component decrypts EXISTING shares where
    // legacy shares may have passwords outside current PASSWORD_MAX limits.
    // We only enforce a generous sanity limit (64KB) to prevent memory issues
    // from accidental large pastes. Any real password is well under this limit.
    if (!value.trim()) {
      setIsPasswordValid(false);
      setPasswordError('Password is required');
    } else if (value.length > VALIDATION_LIMITS.PASSWORD_LEGACY_MAX) {
      setIsPasswordValid(false);
      setPasswordError('Input too long');
    } else {
      setIsPasswordValid(true);
      setPasswordError(undefined);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Determine iteration count based on share version (fallback for legacy data)
      let targetIterations: number;

      if (share.version == null) {
        targetIterations = PBKDF2_ITERATIONS_LEGACY;
      } else if (share.version === 1) {
        targetIterations = PBKDF2_ITERATIONS_V1;
      } else if (share.version === CURRENT_SHARE_VERSION) {
        targetIterations = PBKDF2_ITERATIONS_DEFAULT;
      } else {
        if (isMountedRef.current) {
          setIsPasswordValid(false);
          setPasswordError(
            `Unsupported share version ${share.version}. Please upgrade Igloo Desktop to open this share.`
          );
          setIsSubmitting(false);
        }
        return;
      }

      // Derive key from password and stored salt
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      const secret = await derive_secret_async(password, share.salt, targetIterations);
      
      // Decrypt the share
      const decryptedShare = decrypt_payload(secret, share.encryptedShare);
      
      // Validate the decrypted share format (should start with 'bfshare')
      if (!decryptedShare.startsWith('bfshare')) {
        if (isMountedRef.current) {
          setIsPasswordValid(false);
          setPasswordError('Invalid password or corrupted share data');
          setIsSubmitting(false);
        }
        return;
      }
      
      // Call the onLoad prop with decrypted data
      if (onLoad && isMountedRef.current) {
        onLoad(decryptedShare, share.groupCredential);
      }
      
      // Reset form
      if (isMountedRef.current) {
        setPassword('');
        setIsSubmitting(false);
      }
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      setIsPasswordValid(false);
      setPasswordError('Failed to decrypt share: ' + (err instanceof Error ? err.message : String(err)));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative bg-gray-900 border border-blue-900/50 rounded-lg p-6 shadow-xl backdrop-blur-sm">
      {isSubmitting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-950/70 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
          <span className="text-sm font-medium text-blue-200">Decrypting share…</span>
        </div>
      )}
      <h2 className="text-xl font-semibold text-blue-300 mb-4">
        Load Share {share.name && <span className="text-blue-400">({share.name})</span>}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputWithValidation
          label="Password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          isValid={isPasswordValid}
          errorMessage={passwordError}
          placeholder="Enter password to decrypt this share"
          className="bg-gray-800 border-gray-700 w-full"
          isRequired={true}
          disabled={isSubmitting}
          autoFocus
        />
        
        <div className="flex space-x-3">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-blue-100"
            disabled={isSubmitting || !isPasswordValid}
          >
            {isSubmitting ? "Loading..." : "Load Share"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LoadShare; 
