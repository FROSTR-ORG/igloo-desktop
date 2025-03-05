import React, { useState } from 'react';
import { bytesToHex } from '@noble/hashes/utils';
import { derive_secret, encrypt_payload } from '@/lib/encryption';

interface SaveShareProps {
  onSave?: (password: string, salt: string, encryptedShare: string) => void;
  shareToEncrypt?: string;
}

const SaveShare: React.FC<SaveShareProps> = ({ onSave, shareToEncrypt }) => {
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [passwordsMatch, setPasswordsMatch] = useState<boolean>(true);

  const generateSalt = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return bytesToHex(array);
  };

  const validatePasswords = (pass: string, confirm: string) => {
    if (pass && confirm && pass === confirm) {
      setPasswordsMatch(true);
      setError(null);
    } else if (confirm) {
      setPasswordsMatch(false);
      setError('Passwords do not match');
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    validatePasswords(value, confirmPassword);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    validatePasswords(password, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError('Please enter both password fields');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!shareToEncrypt) {
      setError('No share data to encrypt');
      return;
    }
    
    try {
      // Generate a random salt
      const salt = generateSalt();
      
      // Derive encryption key from password and salt
      const secret = derive_secret(password, salt);
      
      // Encrypt the share
      const encryptedShare = encrypt_payload(secret, shareToEncrypt);
      
      // Clear any errors
      setError(null);
      
      // Call the onSave prop if provided
      if (onSave) {
        onSave(password, salt, encryptedShare);
      }
      
      // Reset form
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to encrypt share: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="bg-gray-900 border border-blue-900/50 rounded-lg p-6 shadow-xl backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-blue-300 mb-4">Save Share</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <label htmlFor="share-password" className="block text-blue-200 text-sm">
            Password
          </label>
          <input
            id="share-password"
            type="password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Enter password to encrypt this share"
            className={`w-full bg-gray-800 border ${
              confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-gray-700'
            } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md px-4 py-2 text-blue-100 placeholder-gray-500`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="block text-blue-200 text-sm">
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => handleConfirmPasswordChange(e.target.value)}
            placeholder="Confirm password"
            className={`w-full bg-gray-800 border ${
              confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-gray-700'
            } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md px-4 py-2 text-blue-100 placeholder-gray-500`}
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-blue-100 font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!password || !confirmPassword || !passwordsMatch}
        >
          Save Share
        </button>
      </form>
    </div>
  );
};

export default SaveShare; 