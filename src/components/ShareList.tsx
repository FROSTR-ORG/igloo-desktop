import React, { useState, useEffect, useCallback } from 'react';
import { clientShareManager, IglooShare } from '@/lib/clientShareManager';
import { FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Modal } from '@/components/ui/modal';
import LoadShare from './LoadShare';
import ConfirmModal from './ui/ConfirmModal';

interface ShareListProps {
  onShareLoaded?: (share: string, groupCredential: string) => void;
  onNewKeyset?: () => void;
}

const ShareList: React.FC<ShareListProps> = ({ onShareLoaded, onNewKeyset }) => {
  const [shares, setShares] = useState<IglooShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingShare, setLoadingShare] = useState<IglooShare | null>(null);
  const [shareToDelete, setShareToDelete] = useState<IglooShare | null>(null);

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
    setLoadingShare(share);
  };

  const handleLoadComplete = (decryptedShare: string, groupCredential: string) => {
    if (onShareLoaded) {
      onShareLoaded(decryptedShare, groupCredential);
    }
    setLoadingShare(null);
  };

  const handleOpenLocation = async (share: IglooShare) => {
    await clientShareManager.openShareLocation(share.id);
  };

  const handleDeleteClick = (share: IglooShare) => {
    setShareToDelete(share);
  };

  const handleDeleteConfirm = async () => {
    if (!shareToDelete) return;
    
    const success = await clientShareManager.deleteShare(shareToDelete.id);
    if (success) {
      setShares(shares.filter(share => share.id !== shareToDelete.id));
    }
    setShareToDelete(null);
  };

  const handleDeleteCancel = () => {
    setShareToDelete(null);
  };

  const closeLoadingModal = useCallback(() => {
    setLoadingShare(null);
  }, []);

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
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<FolderOpen className="h-4 w-4" />}
                  onClick={() => handleOpenLocation(share)}
                  tooltip="Open location"
                  className="text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                />
                <IconButton
                  variant="destructive"
                  size="sm"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => handleDeleteClick(share)}
                  tooltip="Delete share"
                />
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
          <p className="text-sm text-gray-500">Click the Create New button to create a keyset</p>
        </div>
      )}

      <Modal
        isOpen={!!loadingShare}
        onClose={closeLoadingModal}
        maxWidth="max-w-md"
        showCloseButton={false}
      >
        {loadingShare && (
          <LoadShare 
            share={{
              ...loadingShare,
              encryptedShare: loadingShare.share
            }}
            onLoad={handleLoadComplete}
            onCancel={closeLoadingModal}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!shareToDelete}
        title="Delete Share"
        body={
          <div>
            <p>Are you sure you want to delete this share?</p>
            <p className="text-sm text-gray-400 mt-2">
              Share name: <span className="text-blue-400">{shareToDelete?.name}</span>
            </p>
            <p className="text-sm text-gray-400">
              Share ID: <span className="text-blue-400 font-mono">{shareToDelete?.id}</span>
            </p>
          </div>
        }
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
};

export default ShareList; 