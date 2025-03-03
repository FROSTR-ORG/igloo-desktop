import React, {useEffect, useState} from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { decode_group, decode_share } from "@/lib/bifrost";

interface KeysetProps {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
}

interface DecodedShare {
  binder_sn: string;
  hidden_sn: string;
  idx: number;
  seckey: string;
}

const Keyset: React.FC<KeysetProps> = ({ groupCredential, shareCredentials, name }) => {
  const [decodedShares, setDecodedShares] = useState<DecodedShare[]>([]);
  const [decodedGroup, setDecodedGroup] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({});

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here in the future
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleSave = (share: string) => {
    // TODO: Implement save functionality
    console.log('Saving share:', share);
  };

  const handleFinish = () => {
    // TODO: Implement finish functionality
    console.log('Finish clicked');
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const group = decode_group(groupCredential);
    const shares = shareCredentials.map(decode_share);
    setDecodedGroup(group);
    setDecodedShares(shares);
  }, [groupCredential, shareCredentials]);

  const formatShare = (share: string) => {
    if (share.length < 36) return share;
    return `${share.slice(0, 24)}${'*'.repeat(share.length - 24)}${share.slice(-12)}`;
  };

  const renderDecodedInfo = (data: any, rawString?: string) => {
    return (
      <div className="space-y-3">
        {rawString && (
          <div className="space-y-1">
            <div className="text-xs text-gray-400 font-medium">Raw Share String:</div>
            <div className="bg-gray-900/50 p-3 rounded text-xs text-blue-300 font-mono break-all">
              {rawString}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <div className="text-xs text-gray-400 font-medium">Decoded Data:</div>
          <pre className="bg-gray-900/50 p-3 rounded text-xs text-blue-300 font-mono overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
      <CardContent className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-blue-200 mb-4">{name}</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-blue-200 text-sm font-medium">Group Credential</h3>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(groupCredential)}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                >
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded('group')}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                >
                  {expandedItems['group'] ? '▼' : '▶'}
                </Button>
              </div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded text-xs break-all text-blue-300 font-mono">
              {groupCredential}
            </div>
            {decodedGroup && (
              <div className="text-xs text-gray-400">
                Threshold: {decodedGroup.threshold} of {decodedGroup.commits.length} shares required
              </div>
            )}
            {expandedItems['group'] && decodedGroup && (
              <div className="mt-2">
                {renderDecodedInfo(decodedGroup)}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-blue-200 text-sm font-medium">Share Credentials</h3>
            <div className="space-y-3">
              {shareCredentials.map((share, index) => {
                const decodedShare = decodedShares[index];
                return (
                  <div key={index} className="space-y-2">
                    <div className="bg-gray-800/50 p-3 rounded text-xs flex items-start justify-between group">
                      <div className="flex-1 space-y-1">
                        <div className="text-gray-400 font-medium">
                          {name}_share_{decodedShare?.idx || index + 1}
                        </div>
                        <div className="break-all text-blue-300 font-mono mr-4">
                          {formatShare(share)}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(share)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                        >
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSave(share)}
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/30"
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(`${name}-share-${index}`)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                        >
                          {expandedItems[`${name}-share-${index}`] ? '▼' : '▶'}
                        </Button>
                      </div>
                    </div>
                    {expandedItems[`${name}-share-${index}`] && decodedShare && (
                      <div className="ml-4">
                        {renderDecodedInfo(decodedShare, share)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleFinish}
            className="px-8 py-2 bg-green-600 hover:bg-green-700 text-green-100 font-medium transition-colors"
          >
            Finish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Keyset;
