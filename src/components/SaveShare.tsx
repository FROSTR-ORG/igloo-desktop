import React, { useState } from 'react';
import { bytesToHex } from '@noble/hashes/utils';
import { derive_secret, encrypt_payload } from '@/lib/encryption';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Button } from '@/components/ui/button';

interface SaveShareProps {
  onSave?: (password: string, salt: string, encryptedShare: string) => void;
  shareToEncrypt?: string;
}

const SaveShare: React.FC<SaveShareProps> = ({ onSave, shareToEncrypt }) => {
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
    
    try {
      // Generate a random salt
      const salt = generateSalt();
      
      // Derive encryption key from password and salt
      const secret = derive_secret(password, salt);
      
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
    <div className="bg-gray-900 border border-blue-900/50 rounded-lg p-6 shadow-xl backdrop-blur-sm">
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
        
        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-blue-100"
          disabled={isSubmitting || !isPasswordValid || !isConfirmValid || !shareToEncrypt}
        >
          {isSubmitting ? "Saving..." : "Save Share"}
        </Button>
      </form>
    </div>
  );
};

export default SaveShare; 