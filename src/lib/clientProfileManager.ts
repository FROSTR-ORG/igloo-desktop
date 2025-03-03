import { ipcRenderer } from 'electron';

export interface IglooProfile {
  id: string;
  name: string;
  [key: string]: any;
}

class ClientProfileManager {
  async getProfiles(): Promise<IglooProfile[] | false> {
    try {
      return await ipcRenderer.invoke('get-profiles');
    } catch (error) {
      console.error('Error retrieving profiles:', error);
      return false;
    }
  }

  async saveProfile(profile: IglooProfile): Promise<boolean> {
    try {
      return await ipcRenderer.invoke('save-profile', profile);
    } catch (error) {
      console.error('Failed to save profile:', error);
      return false;
    }
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    try {
      return await ipcRenderer.invoke('delete-profile', profileId);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      return false;
    }
  }
}

export const clientProfileManager = new ClientProfileManager(); 