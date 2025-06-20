import React, { useState, useEffect, useCallback } from 'react';
import { clientShareManager, IglooShare } from '@/lib/clientShareManager';
import { decodeGroup, decodeShare } from '@frostr/igloo-core';
import { FolderOpen, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import LoadShare from './LoadShare';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface ShareListProps {
  onShareLoaded?: (share: string, groupCredential: string) => void;
  onNewKeyset?: () => void;
}

// Helper function to extract pubkey from share
const extractPubkeyFromShare = (share: IglooShare): string | null => {
  try {
    console.log('Extracting pubkey for share:', share.name, {
      hasShareCredential: !!share.shareCredential,
      hasMetadata: !!share.metadata,
      metadataBinderSn: share.metadata?.binder_sn,
      shareId: share.id
    });

    // First, decode the group to get all pubkeys
    const decodedGroup = decodeGroup(share.groupCredential);
    console.log('Decoded group:', {
      threshold: decodedGroup.threshold,
      commitsLength: decodedGroup.commits?.length,
      commits: decodedGroup.commits?.map(c => ({ idx: c.idx, pubkey: c.pubkey?.slice(0, 16) + '...' }))
    });
    
    // If we have a shareCredential, decode it to get the index
    if (share.shareCredential) {
      const decodedShare = decodeShare(share.shareCredential);
      console.log('Decoded share credential:', { idx: decodedShare.idx });
      const commit = decodedGroup.commits.find(c => c.idx === decodedShare.idx);
      if (commit) {
        console.log('Found matching commit by shareCredential idx:', commit.idx);
        return commit.pubkey;
      }
    }
    
    // If no shareCredential but we have metadata with binder_sn, try to match
    if (share.metadata?.binder_sn) {
      const commit = decodedGroup.commits.find(c => c.binder_pn === share.metadata!.binder_sn);
      if (commit) {
        console.log('Found matching commit by binder_sn:', commit.idx);
        return commit.pubkey;
      }
    }
    
    // If we only have one commit, return that pubkey
    if (decodedGroup.commits.length === 1) {
      console.log('Using single commit pubkey');
      return decodedGroup.commits[0].pubkey;
    }
    
    // Try to extract from the share name if it contains index information
    const nameMatch = share.name.match(/share[_\s]+(\d+)$/i);
    if (nameMatch) {
      const shareIndex = parseInt(nameMatch[1], 10); // Use 1-based index as-is
      const commit = decodedGroup.commits.find(c => c.idx === shareIndex);
      if (commit) {
        console.log('Found matching commit by name parsing:', commit.idx);
        return commit.pubkey;
      }
    }

    // Also try to extract from the share ID if it contains index information
    const idMatch = share.id.match(/share[_\s]*(\d+)$/i);
    if (idMatch) {
      const shareIndex = parseInt(idMatch[1], 10); // Use 1-based index as-is
      const commit = decodedGroup.commits.find(c => c.idx === shareIndex);
      if (commit) {
        console.log('Found matching commit by ID parsing:', commit.idx);
        return commit.pubkey;
      }
    }
    
    console.log('No pubkey found for share:', share.name);
    return null;
  } catch (error) {
    console.error('Error extracting pubkey from share:', share.name, error);
    return null;
  }
};

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
                            <div className="flex-1 min-w-0">
                <h3 className="text-blue-200 font-medium">{share.name}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  ID: <span className="text-blue-400 font-mono">{share.id}</span>
                </p>
                {(() => {
                  const pubkey = extractPubkeyFromShare(share);
                  return pubkey ? (
                    <p className="text-gray-400 text-sm mt-1">
                      Pubkey: <span className="font-mono text-xs truncate block">{pubkey}</span>
                    </p>
                  ) : null;
                })()}
                {share.savedAt && (
                  <p className="text-gray-500 text-xs mt-1">
                    Saved: {new Date(share.savedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip 
                  trigger={
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={<FolderOpen className="h-4 w-4" />}
                      onClick={() => handleOpenLocation(share)}
                      className="text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                    />
                  }
                  position="top"
                  width="w-fit"
                  content="Open"
                />
                <Tooltip 
                  trigger={
                    <IconButton
                      variant="destructive"
                      size="sm"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => handleDeleteClick(share)}
                    />
                  }
                  position="top"
                  width="w-fit"
                  content="Delete"
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
          <p className="text-sm text-gray-500 mb-4">Get started by creating your first keyset</p>
          {onNewKeyset && (
            <Button
              onClick={onNewKeyset}
              className="bg-blue-600 hover:bg-blue-700 text-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Keyset
            </Button>
          )}
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