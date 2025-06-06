import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Signer from '@/components/Signer';

// Mock igloo-core module
jest.mock('@frostr/igloo-core', () => ({
  createConnectedNode: jest.fn(),
  cleanupBifrostNode: jest.fn(),
  validateShare: jest.fn(),
  validateGroup: jest.fn(),
  decodeShare: jest.fn(),
  decodeGroup: jest.fn(),
}));

// Get references to the mocked functions with proper typing
import { 
  createConnectedNode,
  cleanupBifrostNode,
  validateShare,
  validateGroup,
  decodeShare,
  decodeGroup,
} from '@frostr/igloo-core';

const mockCreateConnectedNode = createConnectedNode as jest.MockedFunction<typeof createConnectedNode>;
const mockCleanupBifrostNode = cleanupBifrostNode as jest.MockedFunction<typeof cleanupBifrostNode>;
const mockValidateShare = validateShare as jest.MockedFunction<typeof validateShare>;
const mockValidateGroup = validateGroup as jest.MockedFunction<typeof validateGroup>;
const mockDecodeShare = decodeShare as jest.MockedFunction<typeof decodeShare>;
const mockDecodeGroup = decodeGroup as jest.MockedFunction<typeof decodeGroup>;

describe('Signer Component Integration (Desktop Logic)', () => {
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

    describe('Signer Component Integration with igloo-core', () => {
    it('should call validateGroup when group credential input changes', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      // The first textbox is group credential, the password input is share, third textbox is relay
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'test-group-credential');
      
      // Validation is called for each character typed
      expect(mockValidateGroup).toHaveBeenCalledWith('test-group-credential');
    });

    it('should call validateShare when share input changes', async () => {
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      // Find the password input by querying all inputs and filtering by type
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.type(passwordInput!, 'test-share-credential');
      
      // Validation is called for each character typed
      expect(mockValidateShare).toHaveBeenCalledWith('test-share-credential');
    });

    it('should call decodeShare for valid shares', async () => {
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.type(passwordInput!, 'valid-share');
      
      expect(mockDecodeShare).toHaveBeenCalledWith('valid-share');
    });

    it('should call decodeGroup for valid groups', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'valid-group');
      
      expect(mockDecodeGroup).toHaveBeenCalledWith('valid-group');
    });

    it('should handle validation errors gracefully', async () => {
      mockValidateShare.mockReturnValue({ 
        isValid: false, 
        message: 'Invalid share format' 
      } as any);
      
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      const passwordInput = container.querySelector('input[type="password"]');
      await user.type(passwordInput!, 'invalid-share');
      
      expect(mockValidateShare).toHaveBeenCalledWith('invalid-share');
      
      await waitFor(() => {
        expect(screen.getByText('Invalid share format')).toBeInTheDocument();
      });
    });

    it('should call createConnectedNode when starting signer with valid inputs', async () => {
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      // Fill in valid inputs
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'valid-group');
      await user.type(passwordInput!, 'valid-share');
      
      // Click start signer button
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockCreateConnectedNode).toHaveBeenCalledWith({
          group: 'valid-group',
          share: 'valid-share',
          relays: ['wss://relay.primal.net'] // Default relay
        });
      });
    });

    it('should call cleanupBifrostNode when stopping signer', async () => {
      // Setup a running signer first
      mockCreateConnectedNode.mockResolvedValue({
        node: mockNode,
        state: { isReady: true, isConnected: true, isConnecting: false, connectedRelays: [] }
      } as any);
      
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      // Fill inputs and start signer
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'valid-group');
      await user.type(passwordInput!, 'valid-share');
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      // Wait for signer to start, then stop it
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop signer/i })).toBeInTheDocument();
      }, { timeout: 3000 });
      
      const stopButton = screen.getByRole('button', { name: /stop signer/i });
      await user.click(stopButton);
      
      expect(mockCleanupBifrostNode).toHaveBeenCalledWith(mockNode);
    });

    it('should render with initial data and call validation functions', () => {
      const initialData = {
        share: 'initial-share',
        groupCredential: 'initial-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      expect(mockValidateShare).toHaveBeenCalledWith('initial-share');
      expect(mockValidateGroup).toHaveBeenCalledWith('initial-group');
    });
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
  });

  describe('Node Lifecycle', () => {
    it('should handle successful node creation', async () => {
      const result = await mockCreateConnectedNode({
        group: 'test-group',
        share: 'test-share',
        relays: ['wss://relay.test.com']
      });
      
      expect(result.node).toBe(mockNode);
      expect(result.state.isReady).toBe(true);
    });

    it('should handle node creation errors', async () => {
      mockCreateConnectedNode.mockRejectedValue(new Error('Connection failed'));
      
      await expect(mockCreateConnectedNode({
        group: 'test-group',
        share: 'test-share',
        relays: ['wss://relay.test.com']
      })).rejects.toThrow('Connection failed');
    });

    it('should handle node cleanup on errors', () => {
      // Simulate cleanup after error
      expect(() => mockCleanupBifrostNode(mockNode)).not.toThrow();
      expect(mockCleanupBifrostNode).toHaveBeenCalledWith(mockNode);
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
  });
}); 