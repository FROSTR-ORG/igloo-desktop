// Import electron and node modules
const electron = require('electron');
const fsModule = require('fs');
const pathModule = require('path');

/**
 * Interface for the profile structure
 * This can be extended based on the actual profile data structure
 */
interface IglooProfile {
  id: string;
  name: string;
  [key: string]: any; // Additional profile properties
}

/**
 * Class to handle profile management operations
 */
class ProfileManager {
  private profilesPath: string;

  constructor() {
    // Get the standardized application data directory
    const appDataPath = electron.app.getPath('appData');
    this.profilesPath = pathModule.join(appDataPath, 'igloo', 'profiles');
    
    // Ensure the profiles directory exists
    this.ensureProfilesDirectory();
  }

  /**
   * Create the profiles directory if it doesn't exist
   */
  private ensureProfilesDirectory(): void {
    const iglooDir = pathModule.join(electron.app.getPath('appData'), 'igloo');
    
    try {
      if (!fsModule.existsSync(iglooDir)) {
        fsModule.mkdirSync(iglooDir);
      }
      
      if (!fsModule.existsSync(this.profilesPath)) {
        fsModule.mkdirSync(this.profilesPath);
      }
    } catch (error) {
      console.error('Failed to create profiles directory:', error);
    }
  }

  /**
   * Retrieves all profiles from the standardized location
   * @returns An array of profiles or false if none found or an error occurs
   */
  getProfiles(): IglooProfile[] | false {
    try {
      // Check if the directory exists
      if (!fsModule.existsSync(this.profilesPath)) {
        return false;
      }

      // Get all files in the profiles directory
      const files = fsModule.readdirSync(this.profilesPath)
        .filter((file: string) => file.endsWith('.json'));

      // If no profile files found
      if (files.length === 0) {
        return false;
      }

      // Read and parse each profile file
      const profiles: IglooProfile[] = [];
      
      for (const file of files) {
        const filePath = pathModule.join(this.profilesPath, file);
        const fileContent = fsModule.readFileSync(filePath, 'utf8');
        
        try {
          const profile = JSON.parse(fileContent) as IglooProfile;
          profiles.push(profile);
        } catch (parseError) {
          console.error(`Failed to parse profile ${file}:`, parseError);
          // Continue with other profiles even if one fails
        }
      }

      return profiles.length > 0 ? profiles : false;
    } catch (error) {
      console.error('Error retrieving profiles:', error);
      return false;
    }
  }

  /**
   * Save a profile to the standardized location
   * @param profile The profile to save
   * @returns True if successful, false otherwise
   */
  saveProfile(profile: IglooProfile): boolean {
    try {
      if (!profile.id) {
        console.error('Profile must have an ID');
        return false;
      }

      const filePath = pathModule.join(this.profilesPath, `${profile.id}.json`);
      fsModule.writeFileSync(filePath, JSON.stringify(profile, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save profile:', error);
      return false;
    }
  }

  /**
   * Delete a profile by ID
   * @param profileId The ID of the profile to delete
   * @returns True if successful, false otherwise
   */
  deleteProfile(profileId: string): boolean {
    try {
      const filePath = pathModule.join(this.profilesPath, `${profileId}.json`);
      
      if (!fsModule.existsSync(filePath)) {
        return false;
      }
      
      fsModule.unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete profile:', error);
      return false;
    }
  }
}

/**
 * Helper function to get all profiles
 * @returns An array of profiles or false if none found
 */
function getAllProfiles(): IglooProfile[] | false {
  const profileManager = new ProfileManager();
  return profileManager.getProfiles();
}

// Export the ProfileManager class and helper functions
module.exports = {
  ProfileManager,
  getAllProfiles,
  IglooProfile: {} as IglooProfile // TypeScript interface isn't directly exportable in CommonJS
}; 