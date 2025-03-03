import React, { useState, useEffect } from 'react';
import { clientShareManager, IglooShare } from '@/lib/clientShareManager';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ShareList: React.FC = () => {
  const [shares, setShares] = useState<IglooShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShares = async () => {
      const result = await clientShareManager.getShares();
      if (Array.isArray(result)) {
        setShares(result);
      }
      setIsLoading(false);
    };
    loadShares();
  }, []);

  const handleLoad = (share: IglooShare) => {
    console.log(`Loading share: ${share.name}`);
    // This would integrate with the actual load functionality later
  };

  const handleOpenLocation = async (share: IglooShare) => {
    await clientShareManager.openShareLocation(share.id);
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
                {share.savedAt && (
                  <p className="text-gray-500 text-xs mt-1">
                    Saved: {new Date(share.savedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenLocation(share)}
                  className="text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                >
                  <FolderOpen className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleLoad(share)}
                  className="bg-blue-600 hover:bg-blue-700 text-blue-100 transition-colors"
                  size="sm"
                >
                  Load
                </Button>
              </div>
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