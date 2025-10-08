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
  private ready: Promise<void>;

  private static readonly SHARE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

  constructor() {
    // Get the standardized application data directory
    const appDataPath = app.getPath('appData');
    this.sharesPath = path.resolve(appDataPath, 'igloo', 'shares');

    // Ensure the shares directory exists asynchronously
    this.ready = this.ensureSharesDirectory();
  }

  /**
   * Get the full file path for a share
   * @param shareId The ID of the share
   * @returns The full file path
   */
  getSharePath(shareId: string): string {
    return this.resolveSharePath(shareId);
  }

  /**
   * Create the shares directory if it doesn't exist
   */
  private async ensureSharesDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.sharesPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create shares directory:', error);
      throw error;
    }
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private sanitizeShareId(shareId: string): string {
    if (typeof shareId !== 'string') {
      throw new Error('Share ID must be a string');
    }

    const trimmed = shareId.trim();

    if (!trimmed) {
      throw new Error('Share ID must be a non-empty string');
    }

    if (/^[.]/.test(trimmed) || /[\\/]/.test(trimmed)) {
      throw new Error('Invalid share ID format');
    }

    const normalized = trimmed
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!normalized || !ShareManager.SHARE_ID_PATTERN.test(normalized)) {
      throw new Error('Invalid share ID format');
    }

    return normalized;
  }

  private resolveSharePath(shareId: string): string {
    const sanitized = this.sanitizeShareId(shareId);
    const basePath = path.resolve(this.sharesPath);
    const resolved = path.resolve(basePath, `${sanitized}.json`);
    const relative = path.relative(basePath, resolved);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Share ID resolves outside of the shares directory');
    }

    return resolved;
  }

  /**
   * Retrieves all shares from the standardized location
   * @returns An array of shares or false if none found or an error occurs
   */
  async getShares(): Promise<IglooShare[] | false> {
    try {
      await this.ensureReady();

      try {
        await fs.promises.access(this.sharesPath, fs.constants.R_OK);
      } catch {
        return false;
      }

      // Get all files in the shares directory
      const files = (await fs.promises.readdir(this.sharesPath))
        .filter(file => file.endsWith('.json'));

      // If no share files found
      if (files.length === 0) {
        return false;
      }

      // Read and parse each share file
      const shares: IglooShare[] = [];

      await Promise.all(
        files.map(async file => {
          const filePath = path.resolve(this.sharesPath, file);

          try {
            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            const share = JSON.parse(fileContent) as IglooShare;
            shares.push(share);
          } catch (error) {
            console.error(`Failed to read share ${file}:`, error);
          }
        })
      );

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
  async saveShare(share: IglooShare): Promise<boolean> {
    try {
      if (!share.id) {
        console.error('Share must have an ID');
        return false;
      }

      await this.ensureReady();

      const filePath = this.resolveSharePath(share.id);
      await fs.promises.writeFile(filePath, JSON.stringify(share, null, 2));
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
  async deleteShare(shareId: string): Promise<boolean> {
    try {
      await this.ensureReady();

      const filePath = this.resolveSharePath(shareId);

      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkError: unknown) {
        if ((unlinkError as NodeJS.ErrnoException).code === 'ENOENT') {
          return false;
        }
        throw unlinkError;
      }

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
async function getAllShares(): Promise<IglooShare[] | false> {
  const shareManager = new ShareManager();
  return shareManager.getShares();
}

export { ShareManager, getAllShares };
