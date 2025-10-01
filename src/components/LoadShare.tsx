import React, { useState } from 'react';
import { 
  derive_secret, 
  decrypt_payload,
  PBKDF2_ITERATIONS_DEFAULT,
  PBKDF2_ITERATIONS_LEGACY,
  PBKDF2_ITERATIONS_V1,
  CURRENT_SHARE_VERSION
} from '@/lib/encryption';
import { InputWithValidation } from '@/components/ui/input-with-validation';
import { Button } from '@/components/ui/button';

interface LoadShareProps {
  share: {
    id: string;
    name: string;
    encryptedShare: string;
    salt: string;
    groupCredential: string;
    version?: number;
  };
  onLoad?: (decryptedShare: string, groupCredential: string) => void;
  onCancel?: () => void;
}

const LoadShare: React.FC<LoadShareProps> = ({ share, onLoad, onCancel }) => {
  const [password, setPassword] = useState<string>('');
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (!value.trim()) {
      setIsPasswordValid(false);
      setPasswordError('Password is required');
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
      const targetIterations = (() => {
        switch (share.version) {
          case 1:
            return PBKDF2_ITERATIONS_V1;
          case CURRENT_SHARE_VERSION:
            return PBKDF2_ITERATIONS_DEFAULT;
          default:
            return PBKDF2_ITERATIONS_LEGACY;
        }
      })();

      // Derive key from password and stored salt
      const secret = derive_secret(password, share.salt, targetIterations);
      
      // Decrypt the share
      const decryptedShare = decrypt_payload(secret, share.encryptedShare);
      
      // Validate the decrypted share format (should start with 'bfshare')
      if (!decryptedShare.startsWith('bfshare')) {
        setIsPasswordValid(false);
        setPasswordError('Invalid password or corrupted share data');
        setIsSubmitting(false);
        return;
      }
      
      // Call the onLoad prop with decrypted data
      if (onLoad) {
        onLoad(decryptedShare, share.groupCredential);
      }
      
      // Reset form
      setPassword('');
      setIsSubmitting(false);
    } catch (err) {
      setIsPasswordValid(false);
      setPasswordError('Failed to decrypt share: ' + (err instanceof Error ? err.message : String(err)));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-blue-900/50 rounded-lg p-6 shadow-xl backdrop-blur-sm">
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
