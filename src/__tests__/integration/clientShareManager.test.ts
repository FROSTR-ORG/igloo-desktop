import { clientShareManager, type IglooShare } from '../../lib/clientShareManager';
import { mockIpcRenderer } from '../setup';

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

      mockIpcRenderer.invoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.getShares();

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-shares');
      expect(result).toEqual(mockShares);
    });

    it('should return false when IPC call fails', async () => {
      mockIpcRenderer.invoke.mockRejectedValue(new Error('IPC Error'));

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

      mockIpcRenderer.invoke.mockResolvedValue(true);

      const result = await clientShareManager.saveShare(testShare);

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-share', testShare);
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

      mockIpcRenderer.invoke.mockRejectedValue(new Error('Save failed'));

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

      // Mock get-shares to return all shares, and let frontend filtering handle the rest
      mockIpcRenderer.invoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.findSharesByBinderSN('abc123');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-shares');
      expect(result).toHaveLength(1);
      expect(result[0].metadata?.binder_sn).toBe('abc123');
    });

    it('should return empty array when no shares match', async () => {
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

      // Mock get-shares to return shares that don't match the query
      mockIpcRenderer.invoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.findSharesByBinderSN('nonexistent');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-shares');
      expect(result).toEqual([]);
    });

    it('should return multiple shares with the same binder_sn', async () => {
      const mockShares: IglooShare[] = [
        {
          id: 'share-1',
          name: 'Share 1',
          share: 'data1',
          salt: 'salt1',
          groupCredential: 'group1',
          metadata: { binder_sn: 'common123' }
        },
        {
          id: 'share-2',
          name: 'Share 2',
          share: 'data2',
          salt: 'salt2',
          groupCredential: 'group2',
          metadata: { binder_sn: 'common123' }
        },
        {
          id: 'share-3',
          name: 'Share 3',
          share: 'data3',
          salt: 'salt3',
          groupCredential: 'group3',
          metadata: { binder_sn: 'different456' }
        }
      ];

      // Mock get-shares to return all shares, and let frontend filtering handle the rest
      mockIpcRenderer.invoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.findSharesByBinderSN('common123');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-shares');
      expect(result).toHaveLength(2);
      expect(result[0].metadata?.binder_sn).toBe('common123');
      expect(result[1].metadata?.binder_sn).toBe('common123');
      expect(result[0].id).toBe('share-1');
      expect(result[1].id).toBe('share-2');
    });

    it('should find shares by partial ID match when metadata is not available', async () => {
      const mockShares: IglooShare[] = [
        {
          id: 'share-abc12345-suffix',
          name: 'Share 1',
          share: 'data1',
          salt: 'salt1',
          groupCredential: 'group1'
          // No metadata with binder_sn
        },
        {
          id: 'share-def67890-suffix',
          name: 'Share 2',
          share: 'data2',
          salt: 'salt2',
          groupCredential: 'group2'
          // No metadata with binder_sn
        }
      ];

      // Mock get-shares to return shares without metadata
      mockIpcRenderer.invoke.mockResolvedValue(mockShares);

      const result = await clientShareManager.findSharesByBinderSN('abc12345');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-shares');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('share-abc12345-suffix');
    });

    it('should handle error when getShares returns false', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(false);

      const result = await clientShareManager.findSharesByBinderSN('abc123');

      expect(result).toEqual([]);
    });
  });

  describe('deleteShare', () => {
    it('should delete share via Electron main process', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(true);

      const result = await clientShareManager.deleteShare('share-id');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('delete-share', 'share-id');
      expect(result).toBe(true);
    });
  });

  describe('openShareLocation', () => {
    it('should open share location in file explorer', async () => {
      mockIpcRenderer.invoke.mockResolvedValue(undefined);

      await clientShareManager.openShareLocation('share-id');

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('open-share-location', 'share-id');
    });

    it('should handle errors gracefully', async () => {
      mockIpcRenderer.invoke.mockRejectedValue(new Error('Failed to open'));

      // Should not throw
      await expect(clientShareManager.openShareLocation('share-id')).resolves.toBeUndefined();
    });
  });
}); 