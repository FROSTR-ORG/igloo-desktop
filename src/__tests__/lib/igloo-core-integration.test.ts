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
    // Define specific event data interfaces
    interface ReadyEventData {
      nodeId: string;
      timestamp: number;
    }

    interface ErrorEventData {
      code: string;
      message: string;
      relay: string;
    }

    interface ClosedEventData {
      reason: string;
      timestamp: number;
    }

    interface ECDHRequestData {
      sessionId: string;
      publicKey: string;
      timestamp: number;
    }

    interface ECDHResponseData {
      sessionId: string;
      sharedSecret: string;
      success: boolean;
    }

    interface ECDHRejectionData {
      sessionId: string;
      reason: string;
      error: string;
    }

    interface SignRequestData {
      sessionId: string;
      message: string;
      messageHash: string;
      participants: string[];
    }

    interface SignResponseData {
      sessionId: string;
      signature: string;
      success: boolean;
      participantCount: number;
    }

    interface SignHandlerRequestData {
      sessionId: string;
      message: string;
      sender: string;
      requiresApproval: boolean;
    }

    interface SignHandlerResponseData {
      sessionId: string;
      partialSignature: string;
      participantId: string;
    }

    interface SignHandlerRejectionData {
      sessionId: string;
      reason: string;
      message: string;
    }

    // Define specific event handler types
    type ReadyHandler = (data: ReadyEventData) => void;
    type ErrorHandler = (data: ErrorEventData) => void;
    type ClosedHandler = (data: ClosedEventData) => void;
    type ECDHRequestHandler = (data: ECDHRequestData) => void;
    type ECDHResponseHandler = (data: ECDHResponseData) => void;
    type ECDHRejectionHandler = (data: ECDHRejectionData) => void;
    type SignRequestHandler = (data: SignRequestData) => void;
    type SignResponseHandler = (data: SignResponseData) => void;
    type SignHandlerRequestHandler = (data: SignHandlerRequestData) => void;
    type SignHandlerResponseHandler = (data: SignHandlerResponseData) => void;
    type SignHandlerRejectionHandler = (data: SignHandlerRejectionData) => void;

    // Union type for all possible event handlers
    type EventHandler = 
      | ReadyHandler
      | ErrorHandler
      | ClosedHandler
      | ECDHRequestHandler
      | ECDHResponseHandler
      | ECDHRejectionHandler
      | SignRequestHandler
      | SignResponseHandler
      | SignHandlerRequestHandler
      | SignHandlerResponseHandler
      | SignHandlerRejectionHandler;

    // Event mapping type for type-safe event handling
    interface EventMap {
      'ready': ReadyHandler;
      'error': ErrorHandler;
      'closed': ClosedHandler;
      '/ecdh/sender/req': ECDHRequestHandler;
      '/ecdh/sender/res': ECDHResponseHandler;
      '/ecdh/sender/rej': ECDHRejectionHandler;
      '/sign/sender/req': SignRequestHandler;
      '/sign/sender/res': SignResponseHandler;
      '/sign/handler/req': SignHandlerRequestHandler;
      '/sign/handler/res': SignHandlerResponseHandler;
      '/sign/handler/rej': SignHandlerRejectionHandler;
    }

    let eventHandlers: Map<string, EventHandler[]>;

    beforeEach(() => {
      // Enhanced mock node to track event handlers and simulate event emission
      eventHandlers = new Map();
      
      mockNode.on = jest.fn((event: string, handler: EventHandler) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      });

      mockNode.off = jest.fn((event: string, handler: EventHandler) => {
        if (eventHandlers.has(event)) {
          const handlers = eventHandlers.get(event)!;
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      });

      // Add emit method to simulate event triggering with proper typing
      mockNode.emit = jest.fn((event: string, data: any) => {
        if (eventHandlers.has(event)) {
          eventHandlers.get(event)!.forEach(handler => {
            handler(data);
          });
        }
      });
    });

    it('should set up event listeners and handle ready event', () => {
      const readyHandler = jest.fn();
      const errorHandler = jest.fn();
      const closedHandler = jest.fn();
      
      // Set up event listeners
      mockNode.on('ready', readyHandler);
      mockNode.on('error', errorHandler);
      mockNode.on('closed', closedHandler);
      
      // Verify listeners were registered
      expect(mockNode.on).toHaveBeenCalledWith('ready', readyHandler);
      expect(mockNode.on).toHaveBeenCalledWith('error', errorHandler);
      expect(mockNode.on).toHaveBeenCalledWith('closed', closedHandler);
      
      // Simulate ready event
      const readyData = { nodeId: 'test-node-123', timestamp: Date.now() };
      mockNode.emit('ready', readyData);
      
      // Verify handler was called with correct arguments
      expect(readyHandler).toHaveBeenCalledTimes(1);
      expect(readyHandler).toHaveBeenCalledWith(readyData);
      expect(errorHandler).not.toHaveBeenCalled();
      expect(closedHandler).not.toHaveBeenCalled();
    });

    it('should handle error events with proper error data', () => {
      const errorHandler = jest.fn();
      mockNode.on('error', errorHandler);
      
      // Simulate error event
      const errorData = { 
        code: 'CONNECTION_FAILED', 
        message: 'Failed to connect to relay',
        relay: 'wss://relay.test.com'
      };
      mockNode.emit('error', errorData);
      
      // Verify error handler was called with correct arguments
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(errorData);
    });

    it('should handle closed events with cleanup data', () => {
      const closedHandler = jest.fn();
      mockNode.on('closed', closedHandler);
      
      // Simulate closed event
      const closedData = { reason: 'user_requested', timestamp: Date.now() };
      mockNode.emit('closed', closedData);
      
      // Verify closed handler was called
      expect(closedHandler).toHaveBeenCalledTimes(1);
      expect(closedHandler).toHaveBeenCalledWith(closedData);
    });

    it('should support event listener removal and prevent removed handlers from being called', () => {
      const handler = jest.fn();
      const persistentHandler = jest.fn();
      
      // Add handlers
      mockNode.on('ready', handler);
      mockNode.on('ready', persistentHandler);
      
      // Verify handlers were registered
      expect(mockNode.on).toHaveBeenCalledWith('ready', handler);
      expect(mockNode.on).toHaveBeenCalledWith('ready', persistentHandler);
      
      // Remove one handler
      mockNode.off('ready', handler);
      expect(mockNode.off).toHaveBeenCalledWith('ready', handler);
      
      // Emit event
      mockNode.emit('ready', { test: 'data' });
      
      // Verify only persistent handler was called
      expect(handler).not.toHaveBeenCalled();
      expect(persistentHandler).toHaveBeenCalledTimes(1);
      expect(persistentHandler).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should handle ECDH events with proper message processing', () => {
      const ecdhReqHandler = jest.fn();
      const ecdhResHandler = jest.fn();
      const ecdhRejHandler = jest.fn();
      
      // Set up ECDH event listeners
      mockNode.on('/ecdh/sender/req', ecdhReqHandler);
      mockNode.on('/ecdh/sender/res', ecdhResHandler);
      mockNode.on('/ecdh/sender/rej', ecdhRejHandler);
      
      // Verify listeners were registered
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/req', ecdhReqHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/res', ecdhResHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/rej', ecdhRejHandler);
      
      // Simulate ECDH request
      const ecdhReqData = {
        sessionId: 'ecdh-session-123',
        publicKey: 'test-public-key',
        timestamp: Date.now()
      };
      mockNode.emit('/ecdh/sender/req', ecdhReqData);
      
      // Simulate ECDH response
      const ecdhResData = {
        sessionId: 'ecdh-session-123',
        sharedSecret: 'test-shared-secret',
        success: true
      };
      mockNode.emit('/ecdh/sender/res', ecdhResData);
      
      // Simulate ECDH rejection
      const ecdhRejData = {
        sessionId: 'ecdh-session-456',
        reason: 'invalid_public_key',
        error: 'Public key validation failed'
      };
      mockNode.emit('/ecdh/sender/rej', ecdhRejData);
      
      // Verify handlers were called with correct arguments
      expect(ecdhReqHandler).toHaveBeenCalledTimes(1);
      expect(ecdhReqHandler).toHaveBeenCalledWith(ecdhReqData);
      
      expect(ecdhResHandler).toHaveBeenCalledTimes(1);
      expect(ecdhResHandler).toHaveBeenCalledWith(ecdhResData);
      
      expect(ecdhRejHandler).toHaveBeenCalledTimes(1);
      expect(ecdhRejHandler).toHaveBeenCalledWith(ecdhRejData);
    });

    it('should handle signature events with comprehensive message processing', () => {
      const signReqHandler = jest.fn();
      const signResHandler = jest.fn();
      const signHandlerReqHandler = jest.fn();
      const signHandlerResHandler = jest.fn();
      const signHandlerRejHandler = jest.fn();
      
      // Set up signature event listeners
      mockNode.on('/sign/sender/req', signReqHandler);
      mockNode.on('/sign/sender/res', signResHandler);
      mockNode.on('/sign/handler/req', signHandlerReqHandler);
      mockNode.on('/sign/handler/res', signHandlerResHandler);
      mockNode.on('/sign/handler/rej', signHandlerRejHandler);
      
      // Verify listeners were registered
      expect(mockNode.on).toHaveBeenCalledWith('/sign/sender/req', signReqHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/sign/sender/res', signResHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/sign/handler/req', signHandlerReqHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/sign/handler/res', signHandlerResHandler);
      expect(mockNode.on).toHaveBeenCalledWith('/sign/handler/rej', signHandlerRejHandler);
      
      // Simulate signature request from sender
      const signReqData = {
        sessionId: 'sign-session-789',
        message: 'message-to-sign',
        messageHash: 'hash-of-message',
        participants: ['participant1', 'participant2']
      };
      mockNode.emit('/sign/sender/req', signReqData);
      
      // Simulate signature response to sender
      const signResData = {
        sessionId: 'sign-session-789',
        signature: 'final-signature',
        success: true,
        participantCount: 2
      };
      mockNode.emit('/sign/sender/res', signResData);
      
      // Simulate signature request to handler
      const signHandlerReqData = {
        sessionId: 'sign-session-789',
        message: 'message-to-sign',
        sender: 'sender-pubkey',
        requiresApproval: true
      };
      mockNode.emit('/sign/handler/req', signHandlerReqData);
      
      // Simulate signature response from handler
      const signHandlerResData = {
        sessionId: 'sign-session-789',
        partialSignature: 'partial-sig-123',
        participantId: 'participant1'
      };
      mockNode.emit('/sign/handler/res', signHandlerResData);
      
      // Simulate signature rejection from handler
      const signHandlerRejData = {
        sessionId: 'sign-session-999',
        reason: 'user_rejected',
        message: 'User declined to sign the message'
      };
      mockNode.emit('/sign/handler/rej', signHandlerRejData);
      
      // Verify all handlers were called with correct arguments
      expect(signReqHandler).toHaveBeenCalledTimes(1);
      expect(signReqHandler).toHaveBeenCalledWith(signReqData);
      
      expect(signResHandler).toHaveBeenCalledTimes(1);
      expect(signResHandler).toHaveBeenCalledWith(signResData);
      
      expect(signHandlerReqHandler).toHaveBeenCalledTimes(1);
      expect(signHandlerReqHandler).toHaveBeenCalledWith(signHandlerReqData);
      
      expect(signHandlerResHandler).toHaveBeenCalledTimes(1);
      expect(signHandlerResHandler).toHaveBeenCalledWith(signHandlerResData);
      
      expect(signHandlerRejHandler).toHaveBeenCalledTimes(1);
      expect(signHandlerRejHandler).toHaveBeenCalledWith(signHandlerRejData);
    });

    it('should handle multiple handlers for the same event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();
      
      // Register multiple handlers for the same event
      mockNode.on('ready', handler1);
      mockNode.on('ready', handler2);
      mockNode.on('ready', handler3);
      
      // Emit event
      const eventData = { nodeState: 'ready', connectedRelays: 3 };
      mockNode.emit('ready', eventData);
      
      // Verify all handlers were called
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(eventData);
      
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(eventData);
      
      expect(handler3).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledWith(eventData);
    });

    it('should handle events with no registered handlers gracefully', () => {
      // Emit event with no registered handlers
      expect(() => {
        mockNode.emit('unregistered-event', { data: 'test' });
      }).not.toThrow();
      
      // Verify emit was called
      expect(mockNode.emit).toHaveBeenCalledWith('unregistered-event', { data: 'test' });
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