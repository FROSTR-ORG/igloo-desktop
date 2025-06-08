// Mock electron and fs modules before importing shareManager
const mockElectron = {
  app: {
    getPath: jest.fn().mockReturnValue('/mock/app/data')
  }
};

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
};

const mockPath = {
  join: jest.fn().mockImplementation((...args) => args.join('/')),
};

jest.mock('electron', () => mockElectron);
jest.mock('fs', () => mockFs);
jest.mock('path', () => mockPath);

describe('ShareManager', () => {
  let ShareManagerClass: typeof import('../../lib/shareManager').ShareManager;
  let getAllSharesFunc: typeof import('../../lib/shareManager').getAllShares;
  let shareManager: import('../../lib/shareManager').ShareManager;

  beforeAll(() => {
    // Import after mocking
    const shareManagerModule = require('../../lib/shareManager');
    ShareManagerClass = shareManagerModule.ShareManager;
    getAllSharesFunc = shareManagerModule.getAllShares;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    shareManager = new ShareManagerClass();
    
    // Default mock behavior
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.readFileSync.mockReturnValue('{}');
  });

  describe('constructor', () => {
    it('should initialize with correct shares path', () => {
      expect(mockElectron.app.getPath).toHaveBeenCalledWith('appData');
      expect(mockPath.join).toHaveBeenCalledWith('/mock/app/data', 'igloo', 'shares');
    });

    it('should create directories if they do not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      new ShareManagerClass();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledTimes(2);
    });

    it('should handle directory creation errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => new ShareManagerClass()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create shares directory:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getSharePath', () => {
    it('should return correct file path for share ID', () => {
      const shareId = 'test-share-123';
      const result = shareManager.getSharePath(shareId);
      
      expect(mockPath.join).toHaveBeenLastCalledWith(
        expect.stringContaining('shares'),
        `${shareId}.json`
      );
      expect(result).toContain('test-share-123.json');
    });
  });

  describe('getShares', () => {
    it('should return false when shares directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = shareManager.getShares();
      
      expect(result).toBe(false);
    });

    it('should return false when no share files found', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = shareManager.getShares();
      
      expect(result).toBe(false);
    });

    it('should return false when only non-JSON files found', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['readme.txt', 'backup.bak']);
      
      const result = shareManager.getShares();
      
      expect(result).toBe(false);
    });

    it('should successfully read and parse share files', () => {
      const mockShare = {
        id: 'test-share',
        name: 'Test Share',
        share: 'share-data',
        groupCredential: 'group-cred'
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['test-share.json', 'other.txt']);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockShare));
      
      const result = shareManager.getShares();
      
      expect(result).toEqual([mockShare]);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should handle corrupted JSON files gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['good.json', 'bad.json']);
      mockFs.readFileSync
        .mockReturnValueOnce('{"id": "good", "name": "Good Share"}')
        .mockReturnValueOnce('invalid json');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = shareManager.getShares();
      
      expect(result).toEqual([{ id: 'good', name: 'Good Share' }]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse share bad.json'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle file system errors', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = shareManager.getShares();
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error retrieving shares:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('saveShare', () => {
    it('should successfully save a valid share', () => {
      const share = {
        id: 'test-share',
        name: 'Test Share',
        share: 'share-data',
        groupCredential: 'group-cred'
      };
      
      const result = shareManager.saveShare(share);
      
      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-share.json'),
        JSON.stringify(share, null, 2)
      );
    });

    it('should reject shares without ID', () => {
      const shareWithoutId = {
        name: 'Test Share',
        share: 'share-data',
        groupCredential: 'group-cred'
      };
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = shareManager.saveShare(shareWithoutId as any);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Share must have an ID');
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle file system write errors', () => {
      const share = {
        id: 'test-share',
        name: 'Test Share',
        share: 'share-data',
        groupCredential: 'group-cred'
      };
      
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write permission denied');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = shareManager.saveShare(share);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save share:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('deleteShare', () => {
    it('should successfully delete existing share', () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const result = shareManager.deleteShare('test-share');
      
      expect(result).toBe(true);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('test-share.json')
      );
    });

    it('should return false when share file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = shareManager.deleteShare('nonexistent-share');
      
      expect(result).toBe(false);
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle file system delete errors', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('File in use');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = shareManager.deleteShare('test-share');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete share:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getAllShares helper function', () => {
    it('should create new ShareManager instance and call getShares', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['share1.json']);
      mockFs.readFileSync.mockReturnValue('{"id": "share1", "name": "Share 1"}');
      
      const result = getAllSharesFunc();
      
      expect(result).toEqual([{ id: 'share1', name: 'Share 1' }]);
    });

    it('should return false when no shares found via helper', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = getAllSharesFunc();
      
      expect(result).toBe(false);
    });
  });
}); 