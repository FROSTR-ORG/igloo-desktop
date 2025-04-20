import React, {useEffect, useState, useCallback} from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { decode_group, decode_share } from "@/lib/bifrost";
import SaveShare from './SaveShare';
import { clientShareManager } from '@/lib/clientShareManager';
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import ConfirmModal from './ui/ConfirmModal';

interface KeysetProps {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
  onFinish?: () => void;
}

interface DecodedShare {
  binder_sn: string;
  hidden_sn: string;
  idx: number;
  seckey: string;
}

const Keyset: React.FC<KeysetProps> = ({ groupCredential, shareCredentials, name, onFinish }) => {
  const [decodedShares, setDecodedShares] = useState<DecodedShare[]>([]);
  const [decodedGroup, setDecodedGroup] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({});
  const [savedShares, setSavedShares] = useState<{[key: number]: boolean}>({});
  const [showSaveDialog, setShowSaveDialog] = useState<{show: boolean, shareIndex: number | null}>({
    show: false,
    shareIndex: null
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleSave = (shareIndex: number) => {
    setShowSaveDialog({ show: true, shareIndex });
  };

  const closeSaveDialog = useCallback(() => {
    setShowSaveDialog({ show: false, shareIndex: null });
  }, []);

  const handleSaveComplete = async (password: string, salt: string, encryptedShare: string) => {
    if (showSaveDialog.shareIndex === null) return;

    const decodedShare = decodedShares[showSaveDialog.shareIndex];
    
    // Create a share object to save
    const share = {
      id: `${name}_share_${decodedShare?.idx || showSaveDialog.shareIndex + 1}`,
      name: `${name} share ${decodedShare?.idx || showSaveDialog.shareIndex + 1}`,
      share: encryptedShare,
      salt,
      groupCredential,
      savedAt: new Date().toISOString()
    };

    // Save the share
    const success = await clientShareManager.saveShare(share);
    
    if (success) {
      setSavedShares(prev => ({
        ...prev,
        [showSaveDialog.shareIndex!]: true
      }));
    }

    // Close the dialog
    closeSaveDialog();
  };

  // Handle escape key press for save dialog
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSaveDialog.show) {
        closeSaveDialog();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [showSaveDialog.show, closeSaveDialog]);

  const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeSaveDialog();
    }
  };

  const handleFinish = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmFinish = () => {
    setShowConfirmModal(false);
    if (onFinish) {
      onFinish();
    }
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
    return `${share.slice(0, 24)}${'*'.repeat(share.length - 24)}`;
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
    <>
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
                    {expandedItems['group'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                          {savedShares[index] ? (
                            <div className="flex items-center justify-center w-[54px] text-emerald-400">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSave(index)}
                              className="text-green-400 hover:text-green-300 hover:bg-green-900/30"
                            >
                              Save
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(`${name}-share-${index}`)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                          >
                            {expandedItems[`${name}-share-${index}`] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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

      {showSaveDialog.show && showSaveDialog.shareIndex !== null && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm z-50"
          onClick={handleOutsideClick}
        >
          <div className="w-full max-w-md mx-4">
            <SaveShare 
              onSave={handleSaveComplete}
              shareToEncrypt={shareCredentials[showSaveDialog.shareIndex]}
              onCancel={closeSaveDialog}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Are you sure?"
        body={
          <>
            <p>This will take you back to the initial screen and your shares will be unavailable unless you saved them through Igloo or backed them up manually.</p>
            <p>You can always recover a keyset using your NSEC or the required threshold of shares.</p>
          </>
        }
        onConfirm={handleConfirmFinish}
        onCancel={() => setShowConfirmModal(false)}
      />
    </>
  );
};

export default Keyset;
