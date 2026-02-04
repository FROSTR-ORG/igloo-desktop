import { decodeShare } from '@frostr/igloo-core';
import type { IglooShare } from '@/types';

// Debug helper for group auto-population
// Set to true locally for debugging share lookups (do not commit as true)
const DEBUG_GROUP_AUTO = false;

// Re-export for backward compatibility
export type { IglooShare };

class ClientShareManager {
  async getShares(): Promise<IglooShare[] | false> {
    try {
      const shares = await window.electronAPI.getShares();
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
    
    // Compute prefix once for efficiency
    const prefix = binderSN.substring(0, 8);
    
        // Filter shares that might have the matching binder_sn
    const matches = shares.filter(share => {
      // Match by metadata if available
      if (share.metadata && share.metadata.binder_sn === binderSN) {
        return true;
      }
      
      // Match by discrete ID segments to prevent false positives
      if (share.id) {
        const idSegments = share.id.split('-');
        const idMatch = idSegments.some(segment => segment === prefix);
        if (idMatch) {
          return true;
        }
      }
      
      // Match by share value if unencrypted
      if (share.shareCredential) {
        try {
          const decodedShare = decodeShare(share.shareCredential);
          return decodedShare.binder_sn === binderSN;
        } catch {
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
      return await window.electronAPI.saveShare(share);
    } catch (error) {
      console.error('Failed to save share:', error);
      return false;
    }
  }

  async deleteShare(shareId: string): Promise<boolean> {
    try {
      return await window.electronAPI.deleteShare(shareId);
    } catch (error) {
      console.error('Failed to delete share:', error);
      return false;
    }
  }

  async openShareLocation(shareId: string): Promise<void> {
    try {
      const result = await window.electronAPI.openShareLocation(shareId);
      if (!result.ok) {
        console.error('Failed to open share location: operation rejected');
      }
    } catch (error) {
      console.error('Failed to open share location:', error);
    }
  }
}

export const clientShareManager = new ClientShareManager(); 