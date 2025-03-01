import React from 'react';

// Interface for profile structure to match the one in profileManager.ts
interface Share {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
}

const ShareList: React.FC = () => {
  // Fake profile data for now
  const fakeShares: Share[] = [
    {
      id: 'share_1698765432',
      name: 'bitcoinplebdev_share_1',
      filename: 'bitcoinplebdev_share_1.json',
      createdAt: '2023-10-31T12:30:45Z'
    },
    {
      id: 'share_1698765987',
      name: 'bitcoinplebdev_share_2',
      filename: 'bitcoinplebdev_share_2.json',
      createdAt: '2023-11-01T09:15:22Z'
    },
    {
      id: 'share_1698766543',
      name: 'bitcoinplebdev_share_3',
      filename: 'bitcoinplebdev_share_3.json',
      createdAt: '2023-11-02T15:45:10Z'
    }
  ];

  // Handler for save button (just a placeholder for now)
  const handleSave = (share: Share) => {
    console.log(`Saving share: ${share.name}`);
    // This would integrate with the actual save functionality later
  };

  return (
    <div className="bg-gray-900/40 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-blue-300 mb-4">Available Profiles</h2>
      
      {fakeShares.length > 0 ? (
        <div className="space-y-3">
          {fakeShares.map((share) => (
            <div 
              key={share.id} 
              className="bg-gray-800/60 rounded-md p-4 flex justify-between items-center border border-gray-700 hover:border-blue-700 transition-colors"
            >
              <div className="flex-1">
                <h3 className="text-blue-200 font-medium">{share.name}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Filename: <span className="text-blue-400 font-mono">{share.filename}</span>
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Created: {new Date(share.createdAt).toLocaleDateString()}
                </p>
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
        <p className="text-gray-400 text-center py-4">No shares available</p>
      )}
    </div>
  );
};

export default ShareList; 