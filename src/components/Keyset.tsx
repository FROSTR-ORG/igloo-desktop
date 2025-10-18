import React, {useEffect, useState, useRef, useCallback} from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { decodeGroup, decodeShare } from "@frostr/igloo-core";
import { ipcRenderer } from 'electron';
import SaveShare from './SaveShare';
import { clientShareManager } from '@/lib/clientShareManager';
import { CURRENT_SHARE_VERSION } from '@/lib/encryption';
import { CheckCircle2, QrCode, Loader2, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import ConfirmModal from './ui/ConfirmModal';
import { QRCodeSVG } from 'qrcode.react';
import type { DecodedShare, DecodedGroup, KeysetProps, RenderableData } from '@/types';

const Keyset: React.FC<KeysetProps> = ({ groupCredential, shareCredentials, name, onFinish }) => {
  const [decodedShares, setDecodedShares] = useState<DecodedShare[]>([]);
  const [decodedGroup, setDecodedGroup] = useState<DecodedGroup | null>(null);
  const [expandedItems, setExpandedItems] = useState<{[key: string]: boolean}>({});
  const [savedShares, setSavedShares] = useState<{[key: number]: boolean}>({});
  const [flashingShares, setFlashingShares] = useState<{[key: number]: boolean}>({});
  const [showSaveDialog, setShowSaveDialog] = useState<{show: boolean, shareIndex: number | null}>({
    show: false,
    shareIndex: null
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showQrCode, setShowQrCode] = useState<{
    show: boolean, 
    shareData: string | null,
    shareIndex: number | null,
    status: 'waiting' | 'success',
    message: string
  }>({
    show: false,
    shareData: null,
    shareIndex: null,
    status: 'waiting',
    message: 'Waiting for share to be scanned...'
  });
  
  const handledEchoSharesRef = useRef<Set<number>>(new Set());
  const echoListenerIdRef = useRef<string | null>(null);

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
      version: CURRENT_SHARE_VERSION,
      savedAt: new Date().toISOString(),
      metadata: {
        binder_sn: decodedShare?.binder_sn,
      },
      policy: {
        defaults: {
          allowSend: true,
          allowReceive: true
        },
        updatedAt: new Date().toISOString()
      }
    };

    // Save the share
    const success = await clientShareManager.saveShare(share);
    
    if (success) {
      markShareAsSaved(showSaveDialog.shareIndex);
    }

    // Close the dialog
    setShowSaveDialog({ show: false, shareIndex: null });
  };

  const handleSaveCancel = () => {
    setShowSaveDialog({ show: false, shareIndex: null });
  };

  const markShareAsSaved = (shareIndex: number) => {
    setSavedShares(prev => ({
      ...prev,
      [shareIndex]: true
    }));
    
    // Trigger flashing animation
    setFlashingShares(prev => ({
      ...prev,
      [shareIndex]: true
    }));
    
    // Remove flash after animation completes
    setTimeout(() => {
      setFlashingShares(prev => ({
        ...prev,
        [shareIndex]: false
      }));
    }, 1500);
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

  const handleShowQrCode = (shareIndex: number) => {
    const selectedShareCredential = shareCredentials[shareIndex];
    if (selectedShareCredential) {
      setShowQrCode({ 
        show: true, 
        shareData: selectedShareCredential,
        shareIndex,
        status: 'waiting',
        message: 'Waiting for share to be scanned...'
      });
    } else {
      console.error("Selected share credential not found, cannot generate QR code");
    }
  };

  const handleCloseQrCode = () => {
    setShowQrCode({
      show: false,
      shareData: null,
      shareIndex: null,
      status: 'waiting',
      message: 'Waiting for share to be scanned...'
    });
  };

  // Handle echo received for any share
  const handleEchoReceived = useCallback((shareIndex: number) => {
    markShareAsSaved(shareIndex);

    // If the echo is for the share currently in the QR modal, update its status
    // Accessing showQrCode directly here will use the latest state due to useCallback's dependencies
    if (showQrCode.show && showQrCode.shareIndex === shareIndex) {
      setShowQrCode(prev => ({
        ...prev,
        status: 'success',
        message: 'Share successfully transferred!'
      }));
    }
  }, [showQrCode.show, showQrCode.shareIndex]); // Dependencies: showQrCode.show and showQrCode.shareIndex

  useEffect(() => {
    const group = decodeGroup(groupCredential);
    const shares = shareCredentials.map(decodeShare);
    setDecodedGroup(group);
    setDecodedShares(shares);
  }, [groupCredential, shareCredentials]);

  useEffect(() => {
    handledEchoSharesRef.current.clear();
  }, [groupCredential, shareCredentials]);

  // Start listening for echoes on all shares via the main-process bridge
  useEffect(() => {
    if (!decodedGroup || shareCredentials.length === 0) {
      if (echoListenerIdRef.current) {
        const listenerId = echoListenerIdRef.current;
        void ipcRenderer.invoke('echo-stop', { listenerId }).catch(() => {
          /* noop */
        });
        echoListenerIdRef.current = null;
      }
      return undefined;
    }

    const listenerId = `keyset-${groupCredential}`;
    echoListenerIdRef.current = listenerId;

    const handleIpcEcho = (_event: unknown, payload: { listenerId: string; shareIndex: number }) => {
      if (!payload || payload.listenerId !== listenerId) {
        return;
      }

      if (!handledEchoSharesRef.current.has(payload.shareIndex)) {
        handledEchoSharesRef.current.add(payload.shareIndex);
        handleEchoReceived(payload.shareIndex);
      }
    };

    ipcRenderer.on('echo-received', handleIpcEcho as never);

    void ipcRenderer
      .invoke('echo-start', {
        listenerId,
        groupCredential,
        shareCredentials,
      })
      .catch(error => {
        console.error('Failed to start echo listener bridge:', error);
      });

    return () => {
      ipcRenderer.removeListener('echo-received', handleIpcEcho as never);
      void ipcRenderer.invoke('echo-stop', { listenerId }).catch(() => {
        /* noop */
      });
      echoListenerIdRef.current = null;
    };
  }, [groupCredential, shareCredentials, decodedGroup, handleEchoReceived]);

  const formatShare = (share: string) => {
    if (share.length < 36) return share;
    return `${share.slice(0, 24)}${'*'.repeat(share.length - 24)}`;
  };

  const renderDecodedInfo = (data: RenderableData, rawString?: string) => {
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
                <div className="flex items-center">
                  <h3 className="text-blue-200 text-sm font-medium">Group Credential</h3>
                  <Tooltip 
                    trigger={<HelpCircle size={16} className="ml-2 text-blue-400 cursor-pointer" />}
                    position="right"
                    content={
                      <>
                        <p className="mb-2 font-semibold">Group Credential:</p>
                        <p>This contains the public information about your keyset, including the threshold and group public key. It starts with &apos;bfgroup&apos; and is shared among all signers to identify the group and signing requirements.</p>
                      </>
                    }
                  />
                </div>
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
                    {expandedItems['group'] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
              <div className="flex items-center">
                <h3 className="text-blue-200 text-sm font-medium">Share Credentials</h3>
                <Tooltip 
                  trigger={<HelpCircle size={16} className="ml-2 text-blue-400 cursor-pointer" />}
                  position="right"
                  content={
                    <>
                      <p className="mb-2 font-semibold">Share Credentials:</p>
                      <p>These are individual secret shares of the private key. Each share starts with &apos;bfshare&apos; and should be kept private and secure. A threshold number of these shares is required to create signatures.</p>
                    </>
                  }
                />
              </div>
              <div className="space-y-3">
                {shareCredentials.map((share, index) => {
                  const decodedShare = decodedShares[index];
                  const isFlashing = flashingShares[index];
                  return (
                    <div key={index} className="space-y-2">
                      <div 
                        className={`
                          relative bg-gray-800/50 p-3 rounded text-xs flex items-start group 
                          ${savedShares[index] ? 'border-2 border-green-500/30 bg-green-900/10' : ''}
                          ${isFlashing ? 'animate-pulse' : ''}
                          transition-all duration-300
                        `}
                        style={{
                          boxShadow: isFlashing ? '0 0 20px rgba(16, 185, 129, 0.7)' : 'none'
                        }}
                      >
                        {savedShares[index] && isFlashing && (
                          <div className="absolute inset-0 bg-green-500/10 rounded z-0 animate-pulse"></div>
                        )}
                        
                        {/* Main content area with fixed layout */}
                        <div className="flex flex-row items-center w-full">
                          {/* Left side with share info */}
                          <div className="flex-1 min-w-0 relative z-10">
                            {/* Share title with badge */}
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium ${savedShares[index] ? 'text-green-400' : 'text-gray-400'}`}>
                                  {name}_share_{decodedShare?.idx || index + 1}
                                </span>
                                {savedShares[index] && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-400 border border-green-600/30">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Saved
                                  </span>
                                )}
                              </div>
                              
                              {/* Share content */}
                              <div className="break-all text-blue-300 font-mono truncate pr-2">
                                {formatShare(share)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Right side with fixed-width button container */}
                          <div className="flex items-center space-x-2 shrink-0">
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
                              onClick={() => handleShowQrCode(index)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            {savedShares[index] ? (
                              <div className="flex items-center justify-center w-[54px] text-green-400">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSave(index)}
                                className="text-green-400 hover:text-green-300 hover:bg-green-900/30 w-[54px]"
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
                              {expandedItems[`${name}-share-${index}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </Button>
                          </div>
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
              onCancel={handleSaveCancel}
              shareToEncrypt={shareCredentials[showSaveDialog.shareIndex]}
            />
          </div>
        </div>
      )}

      {showQrCode.show && showQrCode.shareData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
            <h3 className="text-xl font-semibold text-blue-200 mb-4">Share QR Code</h3>
            
            <div className={`relative flex justify-center p-6 rounded-lg ${
              showQrCode.status === 'success' ? 'bg-green-900/20 border-2 border-green-500/50' : 
              'bg-white'
            }`}>
              {showQrCode.status === 'waiting' && (
                <div className="absolute -top-3 -right-3 animate-pulse">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              )}
              
              {showQrCode.status === 'success' && (
                <div className="absolute -top-4 -right-4 bg-green-500 rounded-full p-1">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
              )}
              
              <QRCodeSVG 
                value={showQrCode.shareData}
                size={250}
                level="H"
              />
              
              {showQrCode.status === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
                  <div className="bg-green-500 rounded-full p-3 shadow-lg">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                </div>
              )}
            </div>
            
            <div className={`mt-5 text-center p-3 rounded-md ${
              showQrCode.status === 'waiting' ? 'bg-blue-900/30 border border-blue-700/50' : 
              'bg-green-900/30 border border-green-700/50'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-1">
                {showQrCode.status === 'waiting' && (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                )}
                {showQrCode.status === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                )}
                <p className={`text-sm font-medium ${
                  showQrCode.status === 'waiting' ? 'text-blue-300' : 
                  'text-green-300'
                }`}>
                  {showQrCode.message}
                </p>
              </div>
              
              {(showQrCode.status === 'waiting') && (
                 <p className="text-xs mt-1 text-gray-400">
                   Scan with any Frostr Connect enabled client - currently only https://frostr-org.github.io/web-demo/
                 </p>
              )}
               {(showQrCode.status === 'success') && (
                 <p className="text-xs mt-1 text-gray-400">
                   The share has been successfully transferred to another device.
                 </p>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleCloseQrCode}
                className={`transition-colors ${
                  showQrCode.status === 'success' ? 
                  'bg-green-600 hover:bg-green-700 text-green-100' : 
                  'bg-blue-600 hover:bg-blue-700 text-blue-100'
                }`}
              >
                {showQrCode.status === 'success' ? 'Done' : 'Close'}
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
