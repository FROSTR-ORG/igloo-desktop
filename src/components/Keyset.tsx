import React, {useEffect, useState} from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { decode_group, decode_share } from "@/lib/bifrost";
import SaveShare from './SaveShare';
import { clientShareManager } from '@/lib/clientShareManager';
import { CheckCircle2, QrCode } from 'lucide-react';
import ConfirmModal from './ui/ConfirmModal';
import { QRCodeSVG } from 'qrcode.react';

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
  const [showQrCode, setShowQrCode] = useState<{show: boolean, shareData: string | null}>({
    show: false,
    shareData: null
  });

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
    setShowSaveDialog({ show: false, shareIndex: null });
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

  const handleShowQrCode = (shareData: string) => {
    setShowQrCode({ show: true, shareData });
  };

  const handleCloseQrCode = () => {
    setShowQrCode({ show: false, shareData: null });
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
                            onClick={() => handleShowQrCode(share)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                          >
                            <QrCode className="w-4 h-4" />
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

      {showSaveDialog.show && showSaveDialog.shareIndex !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="w-full max-w-md mx-4">
            <SaveShare 
              onSave={handleSaveComplete}
              shareToEncrypt={shareCredentials[showSaveDialog.shareIndex]}
            />
          </div>
        </div>
      )}

      {showQrCode.show && showQrCode.shareData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
            <h3 className="text-xl font-semibold text-blue-200 mb-4">Share QR Code</h3>
            <div className="flex justify-center bg-white p-4 rounded-lg">
              <QRCodeSVG 
                value={showQrCode.shareData} 
                size={250}
                level="H"
              />
            </div>
            <p className="text-gray-400 text-xs mt-4 text-center">
              Scan this QR code to import the share on another device
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleCloseQrCode}
                className="bg-blue-600 hover:bg-blue-700 text-blue-100 transition-colors"
              >
                Close
              </Button>
            </div>
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
