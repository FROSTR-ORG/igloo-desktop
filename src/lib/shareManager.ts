// Import electron and node modules
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electron = require('electron');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsModule = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pathModule = require('path');

// Local type definition to avoid ES module imports
interface IglooShare {
  id: string;
  name: string;
  share: string;
  salt: string;
  groupCredential: string;
  version?: number;
  createdAt?: string;
  lastUsed?: string;
  savedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Class to handle share management operations
 */
class ShareManager {
  private sharesPath: string;

  constructor() {
    // Get the standardized application data directory
    const appDataPath = electron.app.getPath('appData');
    this.sharesPath = pathModule.join(appDataPath, 'igloo', 'shares');
    
    // Ensure the shares directory exists
    this.ensureSharesDirectory();
  }

  /**
   * Get the full file path for a share
   * @param shareId The ID of the share
   * @returns The full file path
   */
  getSharePath(shareId: string): string {
    return pathModule.join(this.sharesPath, `${shareId}.json`);
  }

  /**
   * Create the shares directory if it doesn't exist
   */
  private ensureSharesDirectory(): void {
    const iglooDir = pathModule.join(electron.app.getPath('appData'), 'igloo');
    
    try {
      if (!fsModule.existsSync(iglooDir)) {
        fsModule.mkdirSync(iglooDir);
      }
      
      if (!fsModule.existsSync(this.sharesPath)) {
        fsModule.mkdirSync(this.sharesPath);
      }
    } catch (error) {
      console.error('Failed to create shares directory:', error);
    }
  }

  /**
   * Retrieves all shares from the standardized location
   * @returns An array of shares or false if none found or an error occurs
   */
  getShares(): IglooShare[] | false {
    try {
      // Check if the directory exists
      if (!fsModule.existsSync(this.sharesPath)) {
        return false;
      }

      // Get all files in the shares directory
      const files = fsModule.readdirSync(this.sharesPath)
        .filter((file: string) => file.endsWith('.json'));

      // If no share files found
      if (files.length === 0) {
        return false;
      }

      // Read and parse each share file
      const shares: IglooShare[] = [];
      
      for (const file of files) {
        const filePath = pathModule.join(this.sharesPath, file);
        const fileContent = fsModule.readFileSync(filePath, 'utf8');
        
        try {
          const share = JSON.parse(fileContent) as IglooShare;
          shares.push(share);
        } catch (parseError) {
          console.error(`Failed to parse share ${file}:`, parseError);
          // Continue with other shares even if one fails
        }
      }

      return shares.length > 0 ? shares : false;
    } catch (error) {
      console.error('Error retrieving shares:', error);
      return false;
    }
  }

  /**
   * Save a share to the standardized location
   * @param share The share to save
   * @returns True if successful, false otherwise
   */
  saveShare(share: IglooShare): boolean {
    try {
      if (!share.id) {
        console.error('Share must have an ID');
        return false;
      }

      const filePath = pathModule.join(this.sharesPath, `${share.id}.json`);
      fsModule.writeFileSync(filePath, JSON.stringify(share, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save share:', error);
      return false;
    }
  }

  /**
   * Delete a share by ID
   * @param shareId The ID of the share to delete
   * @returns True if successful, false otherwise
   */
  deleteShare(shareId: string): boolean {
    try {
      const filePath = pathModule.join(this.sharesPath, `${shareId}.json`);
      
      if (!fsModule.existsSync(filePath)) {
        return false;
      }
      
      fsModule.unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete share:', error);
      return false;
    }
  }
}

/**
 * Helper function to get all shares
 * @returns An array of shares or false if none found
 */
function getAllShares(): IglooShare[] | false {
  const shareManager = new ShareManager();
  return shareManager.getShares();
}

// Export the ShareManager class and helper functions
module.exports = { ShareManager, getAllShares }; 
