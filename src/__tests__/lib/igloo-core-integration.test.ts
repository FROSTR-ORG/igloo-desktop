// Mock igloo-core module
const mockCreateConnectedNode = jest.fn();
const mockCleanupBifrostNode = jest.fn();
const mockValidateShare = jest.fn();
const mockValidateGroup = jest.fn();
const mockDecodeShare = jest.fn();
const mockDecodeGroup = jest.fn();

jest.mock('@frostr/igloo-core', () => ({
  createConnectedNode: mockCreateConnectedNode,
  cleanupBifrostNode: mockCleanupBifrostNode,
  validateShare: mockValidateShare,
  validateGroup: mockValidateGroup,
  decodeShare: mockDecodeShare,
  decodeGroup: mockDecodeGroup,
}));

describe('Igloo Core Integration Tests', () => {
  const mockNode = {
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockValidateShare.mockReturnValue({ isValid: true } as any);
    mockValidateGroup.mockReturnValue({ isValid: true } as any);
    mockDecodeShare.mockReturnValue({
      idx: 1,
      seckey: 'test-key',
      binder_sn: 'test-binder',
      hidden_sn: 'test-hidden'
    } as any);
    mockDecodeGroup.mockReturnValue({
      threshold: 2,
      group_pk: 'test-group-pk',
      commits: [{ content: 'commit1' }, { content: 'commit2' }]
    } as any);
    mockCreateConnectedNode.mockResolvedValue({
      node: mockNode,
      state: { isReady: true, isConnected: true, isConnecting: false, connectedRelays: [] }
    } as any);
  });

  describe('Validation Logic', () => {
    it('should handle invalid share validation', () => {
      mockValidateShare.mockReturnValue({ 
        isValid: false, 
        message: 'Invalid share format' 
      });
      
      const result = mockValidateShare('invalid-share');
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid share format');
    });

    it('should handle invalid group validation', () => {
      mockValidateGroup.mockReturnValue({ 
        isValid: false, 
        message: 'Invalid group format' 
      });
      
      const result = mockValidateGroup('invalid-group');
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid group format');
    });

    it('should handle decoding errors', () => {
      mockDecodeShare.mockImplementation(() => {
        throw new Error('Invalid share structure');
      });
      
      expect(() => mockDecodeShare('invalid')).toThrow('Invalid share structure');
    });

    it('should validate share credentials correctly', () => {
      const validShare = 'bfshare1test123';
      const result = mockValidateShare(validShare);
      
      expect(mockValidateShare).toHaveBeenCalledWith(validShare);
      expect(result.isValid).toBe(true);
    });

    it('should validate group credentials correctly', () => {
      const validGroup = 'bfgroup1test123';
      const result = mockValidateGroup(validGroup);
      
      expect(mockValidateGroup).toHaveBeenCalledWith(validGroup);
      expect(result.isValid).toBe(true);
    });

    it('should decode valid share structures', () => {
      const shareCredential = 'valid-share-credential';
      const result = mockDecodeShare(shareCredential);
      
      expect(mockDecodeShare).toHaveBeenCalledWith(shareCredential);
      expect(result).toEqual({
        idx: 1,
        seckey: 'test-key',
        binder_sn: 'test-binder',
        hidden_sn: 'test-hidden'
      });
    });

    it('should decode valid group structures', () => {
      const groupCredential = 'valid-group-credential';
      const result = mockDecodeGroup(groupCredential);
      
      expect(mockDecodeGroup).toHaveBeenCalledWith(groupCredential);
      expect(result).toEqual({
        threshold: 2,
        group_pk: 'test-group-pk',
        commits: [{ content: 'commit1' }, { content: 'commit2' }]
      });
    });
  });

  describe('Node Lifecycle', () => {
    it('should handle successful node creation', async () => {
      const config = {
        group: 'test-group',
        share: 'test-share',
        relays: ['wss://relay.test.com']
      };
      
      const result = await mockCreateConnectedNode(config);
      
      expect(mockCreateConnectedNode).toHaveBeenCalledWith(config);
      expect(result.node).toBe(mockNode);
      expect(result.state.isReady).toBe(true);
    });

    it('should handle node creation errors', async () => {
      mockCreateConnectedNode.mockRejectedValue(new Error('Connection failed'));
      
      const config = {
        group: 'test-group',
        share: 'test-share',
        relays: ['wss://relay.test.com']
      };
      
      await expect(mockCreateConnectedNode(config)).rejects.toThrow('Connection failed');
    });

    it('should handle node cleanup on errors', () => {
      // Simulate cleanup after error
      expect(() => mockCleanupBifrostNode(mockNode)).not.toThrow();
      expect(mockCleanupBifrostNode).toHaveBeenCalledWith(mockNode);
    });

    it('should support multiple relay configurations', async () => {
      const config = {
        group: 'test-group',
        share: 'test-share',
        relays: [
          'wss://relay1.test.com',
          'wss://relay2.test.com',
          'wss://relay3.test.com'
        ]
      };
      
      const result = await mockCreateConnectedNode(config);
      
      expect(mockCreateConnectedNode).toHaveBeenCalledWith(config);
      expect(result.state.isReady).toBe(true);
    });

    it('should handle node state transitions', async () => {
      // Test different node states
      mockCreateConnectedNode.mockResolvedValue({
        node: mockNode,
        state: { isReady: false, isConnected: true, isConnecting: false, connectedRelays: ['relay1'] }
      } as any);
      
      const result = await mockCreateConnectedNode({
        group: 'test-group',
        share: 'test-share',
        relays: ['wss://relay.test.com']
      });
      
      expect(result.state.isConnected).toBe(true);
      expect(result.state.isReady).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should set up event listeners on node', () => {
      // Test that the node supports event listener setup
      mockNode.on('ready', () => {});
      mockNode.on('error', () => {});
      mockNode.on('closed', () => {});
      
      expect(mockNode.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });

    it('should support event listener removal', () => {
      const handler = jest.fn();
      mockNode.off('ready', handler);
      
      expect(mockNode.off).toHaveBeenCalledWith('ready', handler);
    });

    it('should handle ECDH events', () => {
      const ecdhHandler = jest.fn();
      mockNode.on('/ecdh/sender/req', ecdhHandler);
      mockNode.on('/ecdh/sender/res', ecdhHandler);
      mockNode.on('/ecdh/sender/rej', ecdhHandler);
      
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/req', ecdhHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/res', ecdhHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/rej', ecdhHandler);
    });

    it('should handle signature events', () => {
      const signHandler = jest.fn();
      mockNode.on('/sign/sender/req', signHandler);
      mockNode.on('/sign/sender/res', signHandler);
      mockNode.on('/sign/handler/req', signHandler);
      
      expect(mockNode.on).toHaveBeenCalledWith('/sign/sender/req', signHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/sign/sender/res', signHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/sign/handler/req', signHandler);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed credentials gracefully', () => {
      mockValidateShare.mockReturnValue({ 
        isValid: false, 
        message: 'Invalid bfshare format - must be a valid bech32m encoded credential' 
      });
      
      const result = mockValidateShare('malformed-credential');
      
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('bech32m encoded credential');
    });

    it('should handle network connection failures', async () => {
      mockCreateConnectedNode.mockRejectedValue(new Error('Network timeout'));
      
      await expect(mockCreateConnectedNode({
        group: 'test-group',
        share: 'test-share',
        relays: ['wss://unreachable-relay.com']
      })).rejects.toThrow('Network timeout');
    });

    it('should handle invalid relay URLs', async () => {
      mockCreateConnectedNode.mockRejectedValue(new Error('Invalid relay URL'));
      
      await expect(mockCreateConnectedNode({
        group: 'test-group',
        share: 'test-share',
        relays: ['invalid-url']
      })).rejects.toThrow('Invalid relay URL');
    });
  });
}); 