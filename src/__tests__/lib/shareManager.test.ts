const getPathMock = jest.fn().mockReturnValue('/mock/app/data');

const fsPromises = {
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue<string[]>([]),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
};

jest.mock('electron', () => ({
  app: {
    getPath: getPathMock,
  },
}));

jest.mock('fs', () => ({
  promises: fsPromises,
  constants: { R_OK: 4 },
}));

import type { IglooShare } from '../../types';
import { ShareManager, getAllShares } from '../../lib/shareManager';

describe('ShareManager', () => {
  let shareManager: ShareManager;

  beforeEach(() => {
    jest.clearAllMocks();
    fsPromises.mkdir.mockResolvedValue(undefined);
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.readdir.mockResolvedValue([]);
    fsPromises.readFile.mockResolvedValue('{}');
    fsPromises.writeFile.mockResolvedValue(undefined);
    fsPromises.unlink.mockResolvedValue(undefined);
    shareManager = new ShareManager();
  });

  describe('constructor', () => {
    it('initialises shares directory path', () => {
      expect(getPathMock).toHaveBeenCalledWith('appData');
      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/mock/app/data/igloo/shares'),
        { recursive: true, mode: 0o700 }
      );
    });

    it('surfaces directory creation errors', async () => {
      fsPromises.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const manager = new ShareManager();
      await expect(manager.getShares()).resolves.toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create shares directory:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getSharePath', () => {
    it('returns canonicalised file path for valid IDs', () => {
      const result = shareManager.getSharePath('test-share-123');
      expect(result).toContain('test-share-123.json');
    });

    it('rejects invalid share IDs', () => {
      expect(() => shareManager.getSharePath('../evil')).toThrow('Invalid share ID format');
    });
  });

  describe('getShares', () => {
    it('returns false when directory is missing', async () => {
      fsPromises.access.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
      await expect(shareManager.getShares()).resolves.toBe(false);
    });

    it('returns false when no share files exist', async () => {
      fsPromises.readdir.mockResolvedValueOnce([]);
      await expect(shareManager.getShares()).resolves.toBe(false);
    });

    it('filters non JSON files', async () => {
      fsPromises.readdir.mockResolvedValueOnce(['readme.txt', 'backup.bak']);
      await expect(shareManager.getShares()).resolves.toBe(false);
    });

    it('parses share files', async () => {
      const mockShare = {
        id: 'test-share',
        name: 'Test Share',
        share: 'share-data',
        salt: 'test-salt',
        groupCredential: 'group-cred',
      } satisfies IglooShare;

      fsPromises.readdir.mockResolvedValueOnce(['test-share.json']);
      fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(mockShare));

      await expect(shareManager.getShares()).resolves.toEqual([mockShare]);
      expect(fsPromises.readFile).toHaveBeenCalledWith(expect.stringContaining('test-share.json'), 'utf8');
    });

    it('continues past corrupt JSON', async () => {
      fsPromises.readdir.mockResolvedValueOnce(['good.json', 'bad.json']);
      fsPromises.readFile
        .mockResolvedValueOnce('{"id":"good","name":"Good Share"}')
        .mockResolvedValueOnce('invalid json');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(shareManager.getShares()).resolves.toEqual([{ id: 'good', name: 'Good Share' }]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read share bad.json'), expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles filesystem errors', async () => {
      fsPromises.readdir.mockRejectedValueOnce(new Error('boom'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(shareManager.getShares()).resolves.toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error retrieving shares:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('saveShare', () => {
    const baseShare: IglooShare = {
      id: 'test-share',
      name: 'Test Share',
      share: 'share-data',
      salt: 'test-salt',
      groupCredential: 'group-cred',
    };

    it('writes share to disk', async () => {
      await expect(shareManager.saveShare(baseShare)).resolves.toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-share.json'),
        JSON.stringify(baseShare, null, 2),
        { mode: 0o600 }
      );
    });

    it('rejects missing ID', async () => {
      const share = { ...baseShare, id: '' } as IglooShare;
      await expect(shareManager.saveShare(share)).resolves.toBe(false);
      expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });

    it('propagates write errors', async () => {
      fsPromises.writeFile.mockRejectedValueOnce(new Error('write error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(shareManager.saveShare(baseShare)).resolves.toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save share:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('deleteShare', () => {
    it('deletes existing share', async () => {
      await expect(shareManager.deleteShare('test-share')).resolves.toBe(true);
      expect(fsPromises.unlink).toHaveBeenCalledWith(expect.stringContaining('test-share.json'));
    });

    it('returns false for missing share', async () => {
      fsPromises.unlink.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
      await expect(shareManager.deleteShare('missing')).resolves.toBe(false);
    });

    it('logs delete errors', async () => {
      fsPromises.unlink.mockRejectedValueOnce(new Error('unlink error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(shareManager.deleteShare('test-share')).resolves.toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete share:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getAllShares helper', () => {
    it('delegates to ShareManager#getShares', async () => {
      const spy = jest.spyOn(ShareManager.prototype, 'getShares').mockResolvedValueOnce([]);
      await expect(getAllShares()).resolves.toEqual([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('returns false when ShareManager yields nothing', async () => {
      jest.spyOn(ShareManager.prototype, 'getShares').mockResolvedValueOnce(false);
      await expect(getAllShares()).resolves.toBe(false);
    });
  });
});
