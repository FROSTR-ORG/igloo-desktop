import { ipcRenderer } from 'electron';

export interface IglooShare {
  id: string;
  name: string;
  share: string;
  groupCredential: string;
  [key: string]: any;
}

class ClientShareManager {
  async getShares(): Promise<IglooShare[] | false> {
    try {
      return await ipcRenderer.invoke('get-shares');
    } catch (error) {
      console.error('Error retrieving shares:', error);
      return false;
    }
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