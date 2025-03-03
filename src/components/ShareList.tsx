import React, { useState, useEffect } from 'react';
import { clientProfileManager, IglooProfile } from '@/lib/clientProfileManager';

const ShareList: React.FC = () => {
  const [shares, setShares] = useState<IglooProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShares = async () => {
      const result = await clientProfileManager.getProfiles();
      if (Array.isArray(result)) {
        setShares(result);
      }
      setIsLoading(false);
    };
    loadShares();
  }, []);

  const handleSave = async (share: IglooProfile) => {
    console.log(`Saving share: ${share.name}`);
    // This would integrate with the actual save functionality later
  };

  return (
    <>
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-pulse text-gray-400">Loading shares...</div>
        </div>
      ) : shares.length > 0 ? (
        <div className="space-y-3">
          {shares.map((share) => (
            <div 
              key={share.id} 
              className="bg-gray-800/60 rounded-md p-4 flex justify-between items-center border border-gray-700 hover:border-blue-700 transition-colors"
            >
              <div className="flex-1">
                <h3 className="text-blue-200 font-medium">{share.name}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  ID: <span className="text-blue-400 font-mono">{share.id}</span>
                </p>
                {share.createdAt && (
                  <p className="text-gray-500 text-xs mt-1">
                    Created: {new Date(share.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleSave(share)}
                className="ml-4 bg-blue-600 hover:bg-blue-700 text-blue-100 px-4 py-2 rounded-md transition-colors text-sm"
              >
                Save
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">No shares available</p>
          <p className="text-sm text-gray-500">Switch to the Create tab to create your first share</p>
        </div>
      )}
    </>
  );
};

export default ShareList; 