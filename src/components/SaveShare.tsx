import React, { useState } from 'react';

interface SaveShareProps {
  onSave?: (password: string) => void;
}

const SaveShare: React.FC<SaveShareProps> = ({ onSave }) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Please enter a password');
      return;
    }
    
    // Clear any errors
    setError(null);
    
    // Call the onSave prop if provided
    if (onSave) {
      onSave(password);
    } else {
      // For now, just log the data
      console.log('Saving share:', { password: '****' });
    }
    
    // Reset form
    setPassword('');
  };

  return (
    <div className="bg-gray-900/40 rounded-lg p-6 shadow-lg">
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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to encrypt this share"
            className="w-full bg-gray-800/60 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md px-4 py-2 text-blue-100 placeholder-gray-500"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-blue-100 font-medium py-2 px-4 rounded-md transition-colors"
        >
          Save Share
        </button>
      </form>
    </div>
  );
};

export default SaveShare; 