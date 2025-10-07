import { app } from 'electron';
import fs from 'fs';
import path from 'path';

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
  policy?: {
    defaults: {
      allowSend: boolean;
      allowReceive: boolean;
    };
    peers?: Record<string, {
      allowSend: boolean;
      allowReceive: boolean;
      updatedAt?: string;
    }>;
    updatedAt?: string;
  };
}

/**
 * Class to handle share management operations
 */
class ShareManager {
  private sharesPath: string;

  constructor() {
    // Get the standardized application data directory
    const appDataPath = app.getPath('appData');
    this.sharesPath = path.join(appDataPath, 'igloo', 'shares');
    
    // Ensure the shares directory exists
    this.ensureSharesDirectory();
  }

  /**
   * Get the full file path for a share
   * @param shareId The ID of the share
   * @returns The full file path
   */
  getSharePath(shareId: string): string {
    return path.join(this.sharesPath, `${shareId}.json`);
  }

  /**
   * Create the shares directory if it doesn't exist
   */
  private ensureSharesDirectory(): void {
    const iglooDir = path.join(app.getPath('appData'), 'igloo');
    
    try {
      if (!fs.existsSync(iglooDir)) {
        fs.mkdirSync(iglooDir);
      }
      
      if (!fs.existsSync(this.sharesPath)) {
        fs.mkdirSync(this.sharesPath);
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
      if (!fs.existsSync(this.sharesPath)) {
        return false;
      }

      // Get all files in the shares directory
      const files = fs.readdirSync(this.sharesPath)
        .filter((file: string) => file.endsWith('.json'));

      // If no share files found
      if (files.length === 0) {
        return false;
      }

      // Read and parse each share file
      const shares: IglooShare[] = [];
      
      for (const file of files) {
        const filePath = path.join(this.sharesPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
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

      const filePath = path.join(this.sharesPath, `${share.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(share, null, 2));
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
      const filePath = path.join(this.sharesPath, `${shareId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      fs.unlinkSync(filePath);
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

export { ShareManager, getAllShares };
