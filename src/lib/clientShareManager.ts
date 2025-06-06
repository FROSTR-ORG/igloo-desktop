import { ipcRenderer } from 'electron';

// Debug helper for group auto-population
const DEBUG_GROUP_AUTO = true;

export interface IglooShare {
  id: string;
  name: string;
  share: string;
  salt: string;
  groupCredential: string;
  savedAt?: string;
  shareCredential?: string;
  metadata?: {
    binder_sn?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

class ClientShareManager {
  async getShares(): Promise<IglooShare[] | false> {
    try {
      const shares = await ipcRenderer.invoke('get-shares');
      if (DEBUG_GROUP_AUTO) {
        console.log('Retrieved shares:', shares);
      }
      return shares;
    } catch (error) {
      console.error('Error retrieving shares:', error);
      return false;
    }
  }

  async findSharesByBinderSN(binderSN: string): Promise<IglooShare[]> {
    const shares = await this.getShares();
    if (!shares || !Array.isArray(shares)) return [];
    
    // Filter shares that might have the matching binder_sn
    const matches = shares.filter(share => {
      // Match by metadata if available
      if (share.metadata && share.metadata.binder_sn === binderSN) {
        return true;
      }
      
      // Match by partial share ID (some implementations store this)
      if (share.id && share.id.includes(binderSN.substring(0, 8))) {
        return true;
      }
      
      // Match by share value if unencrypted
      if (share.shareCredential) {
        try {
          // Note: Could use decodeShare from @frostr/igloo-core if needed
          // import { decodeShare } from '@frostr/igloo-core';
          // const decodedShare = decodeShare(share.shareCredential);
          // return decodedShare.binder_sn === binderSN;
          return false; // Implement if needed
        } catch (e) {
          return false;
        }
      }
      
      return false;
    });
    
    if (DEBUG_GROUP_AUTO) {
      console.log(`Found ${matches.length} shares matching binder_sn: ${binderSN}`);
    }
    
    return matches;
  }

  async saveShare(share: IglooShare): Promise<boolean> {
    try {
      return await ipcRenderer.invoke('save-share', share);
    } catch (error) {
      console.error('Failed to save share:', error);
      return false;
    }
  }

  async deleteShare(shareId: string): Promise<boolean> {
    try {
      return await ipcRenderer.invoke('delete-share', shareId);
    } catch (error) {
      console.error('Failed to delete share:', error);
      return false;
    }
  }

  async openShareLocation(shareId: string): Promise<void> {
    try {
      await ipcRenderer.invoke('open-share-location', shareId);
    } catch (error) {
      console.error('Failed to open share location:', error);
    }
  }
}

export const clientShareManager = new ClientShareManager(); 