import React, { useState } from 'react';
import { derive_secret, decrypt_payload } from '@/lib/encryption';

interface LoadShareProps {
  share: {
    id: string;
    name: string;
    share: string; // encrypted share
    salt: string;
    groupCredential: string;
  };
  onLoad?: (decryptedShare: string, groupCredential: string) => void;
  onCancel?: () => void;
}

// validate share is part of group
// validate correct index
// validate share is not already loaded

const LoadShare: React.FC<LoadShareProps> = ({ share, onLoad, onCancel }) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Please enter your password');
      return;
    }
    
    try {
      // Derive key from password and stored salt
      const secret = derive_secret(password, share.salt);
      
      // Decrypt the share
      const decryptedShare = decrypt_payload(secret, share.share);
      
      // Validate the decrypted share format (should start with 'bfshare1')
      if (!decryptedShare.startsWith('bfshare1')) {
        setError('Invalid password or corrupted share data');
        return;
      }
      
      // Clear any errors
      setError(null);
      
      // Call the onLoad prop with decrypted data
      if (onLoad) {
        onLoad(decryptedShare, share.groupCredential);
      }
      
      // Reset form
      setPassword('');
    } catch (err) {
      setError('Failed to decrypt share: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="bg-gray-900 border border-blue-900/50 rounded-lg p-6 shadow-xl backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-blue-300 mb-4">
        Load Share {share.name && <span className="text-blue-400">({share.name})</span>}
      </h2>
      
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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to decrypt this share"
            className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md px-4 py-2 text-blue-100 placeholder-gray-500"
            autoFocus
          />
        </div>
        
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 font-medium py-2 px-4 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-blue-100 font-medium py-2 px-4 rounded-md transition-colors"
          >
            Load Share
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoadShare; 