// Mock Electron's IPC renderer - must be done before any imports
const mockInvoke = jest.fn();
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: mockInvoke
  }
}));

import { clientShareManager, type IglooShare } from '../../lib/clientShareManager';

describe('ClientShareManager (Desktop Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShares', () => {
    it('should retrieve shares from Electron main process', async () => {
      const mockShares: IglooShare[] = [
        {
          id: 'test-share-1',
          name: 'Test Share 1',
          share: 'encrypted-share-data',
          salt: 'test-salt',
          groupCredential: 'test-group',
          savedAt: '2025-01-20T12:00:00Z'
        }
      ];

      mockInvoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.getShares();

      expect(mockInvoke).toHaveBeenCalledWith('get-shares');
      expect(result).toEqual(mockShares);
    });

    it('should return false when IPC call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC Error'));

      const result = await clientShareManager.getShares();

      expect(result).toBe(false);
    });
  });

  describe('saveShare', () => {
    it('should save share via Electron main process', async () => {
      const testShare: IglooShare = {
        id: 'new-share',
        name: 'New Share',
        share: 'share-data',
        salt: 'salt',
        groupCredential: 'group'
      };

      mockInvoke.mockResolvedValue(true);

      const result = await clientShareManager.saveShare(testShare);

      expect(mockInvoke).toHaveBeenCalledWith('save-share', testShare);
      expect(result).toBe(true);
    });

    it('should return false when save fails', async () => {
      const testShare: IglooShare = {
        id: 'new-share',
        name: 'New Share',
        share: 'share-data',
        salt: 'salt',
        groupCredential: 'group'
      };

      mockInvoke.mockRejectedValue(new Error('Save failed'));

      const result = await clientShareManager.saveShare(testShare);

      expect(result).toBe(false);
    });
  });

  describe('findSharesByBinderSN', () => {
    it('should find shares by binder serial number', async () => {
      const mockShares: IglooShare[] = [
        {
          id: 'share-1',
          name: 'Share 1',
          share: 'data',
          salt: 'salt',
          groupCredential: 'group',
          metadata: { binder_sn: 'abc123' }
        },
        {
          id: 'share-2',
          name: 'Share 2',
          share: 'data',
          salt: 'salt',
          groupCredential: 'group',
          metadata: { binder_sn: 'def456' }
        }
      ];

      mockInvoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.findSharesByBinderSN('abc123');

      expect(result).toHaveLength(1);
      expect(result[0].metadata?.binder_sn).toBe('abc123');
    });

    it('should return empty array when no shares match', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await clientShareManager.findSharesByBinderSN('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('deleteShare', () => {
    it('should delete share via Electron main process', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await clientShareManager.deleteShare('share-id');

      expect(mockInvoke).toHaveBeenCalledWith('delete-share', 'share-id');
      expect(result).toBe(true);
    });
  });

  describe('openShareLocation', () => {
    it('should open share location in file explorer', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await clientShareManager.openShareLocation('share-id');

      expect(mockInvoke).toHaveBeenCalledWith('open-share-location', 'share-id');
    });

    it('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to open'));

      // Should not throw
      await expect(clientShareManager.openShareLocation('share-id')).resolves.toBeUndefined();
    });
  });
}); 