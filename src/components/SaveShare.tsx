import React, { useState } from 'react';
import { bytesToHex } from '@noble/hashes/utils';
import { derive_secret_async, encrypt_payload } from '@/lib/encryption';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SaveShareProps {
  onSave?: (password: string, salt: string, encryptedShare: string) => void;
  onCancel?: () => void;
  shareToEncrypt?: string;
}

const SaveShare: React.FC<SaveShareProps> = ({ onSave, onCancel, shareToEncrypt }) => {
  const [password, setPassword] = useState<string>('');
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isConfirmValid, setIsConfirmValid] = useState<boolean>(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const generateSalt = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return bytesToHex(array);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    
    // Validate password
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
    
    // Re-validate confirm password if it has a value
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid || !isConfirmValid || !shareToEncrypt) {
      return;
    }
    
    setIsSubmitting(true);
    // Allow the UI to render the loading state before doing CPU-heavy work
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    
    try {
      // Generate a random salt
      const salt = generateSalt();
      
      // Derive encryption key from password and salt (async to avoid blocking UI)
      const secret = await derive_secret_async(password, salt);
      
      // Encrypt the share
      const encryptedShare = encrypt_payload(secret, shareToEncrypt);
      
      // Call the onSave prop if provided
      if (onSave) {
        onSave(password, salt, encryptedShare);
      }
      
      // Reset form
      setPassword('');
      setConfirmPassword('');
      setIsPasswordValid(false);
      setIsConfirmValid(false);
    } catch (err) {
      setPasswordError('Failed to encrypt share: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative bg-gray-900 border border-blue-900/50 rounded-lg p-6 shadow-xl backdrop-blur-sm">
      {isSubmitting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-950/70 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
          <span className="text-sm font-medium text-blue-200">Encrypting share…</span>
        </div>
      )}
      <h2 className="text-xl font-semibold text-blue-300 mb-4">Save Share</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputWithValidation
          label="Password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          isValid={isPasswordValid}
          errorMessage={passwordError}
          placeholder="Enter password to encrypt this share"
          className="bg-gray-800 border-gray-700 w-full"
          isRequired={true}
          disabled={isSubmitting}
        />

        <InputWithValidation
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          isValid={isConfirmValid}
          errorMessage={confirmError}
          placeholder="Confirm password"
          className="bg-gray-800 border-gray-700 w-full"
          isRequired={true}
          disabled={isSubmitting}
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
            disabled={isSubmitting || !isPasswordValid || !isConfirmValid || !shareToEncrypt}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              "Save Share"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SaveShare; 
