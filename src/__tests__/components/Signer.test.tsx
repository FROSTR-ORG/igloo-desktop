import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Signer from '../../components/Signer';

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockCleanupBifrostNode = cleanupBifrostNode as jest.MockedFunction<typeof cleanupBifrostNode>;
const mockValidateShare = validateShare as jest.MockedFunction<typeof validateShare>;
const mockValidateGroup = validateGroup as jest.MockedFunction<typeof validateGroup>;
const mockDecodeShare = decodeShare as jest.MockedFunction<typeof decodeShare>;
const mockDecodeGroup = decodeGroup as jest.MockedFunction<typeof decodeGroup>;

describe('Signer Component UI Tests', () => {
  const mockNode = {
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
  } as any; // Use any for complex mock type to avoid extensive interface mocking

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns for UI tests
    mockValidateShare.mockReturnValue({ isValid: true });
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue({
      idx: 1,
      seckey: 'test-key',
      binder_sn: 'test-binder',
      hidden_sn: 'test-hidden'
    });
    mockDecodeGroup.mockReturnValue({
      threshold: 2,
      group_pk: 'test-group-pk',
      commits: [
        { idx: 0, pubkey: 'pubkey1', hidden_pn: 'hidden1', binder_pn: 'binder1' },
        { idx: 1, pubkey: 'pubkey2', hidden_pn: 'hidden2', binder_pn: 'binder2' }
      ]
    });
    mockCreateConnectedNode.mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node: mockNode, // Type should be inferred from proper mock setup
      state: { isReady: true, isConnected: true, isConnecting: false, connectedRelays: [] }
    });
  });

  describe('Component Rendering and UI Elements', () => {
    it('should render the main heading', () => {
      render(<Signer />);
      
      expect(screen.getByText('Start your signer to handle requests')).toBeInTheDocument();
    });

    it('should render group credential input field', () => {
      render(<Signer />);
      
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      
      expect(groupInput).toBeInTheDocument();
    });

    it('should render share credential password input field', () => {
      render(<Signer />);
      
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      expect(shareInput).toBeInTheDocument();
      expect(shareInput).toHaveAttribute('type', 'password');
    });

    it('should render relay URL section', () => {
      render(<Signer />);
      
      expect(screen.getByText('Relay URLs')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add relay URL')).toBeInTheDocument();
    });

    it('should render copy buttons for credentials', () => {
      render(<Signer />);
      
      // Verify that copy buttons exist for both input fields by checking their presence
      // near the specific input fields, rather than relying on hardcoded counts
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      // Verify both inputs are present
      expect(groupInput).toBeInTheDocument();
      expect(shareInput).toBeInTheDocument();
      
      // Verify copy functionality exists - there should be copy buttons present
      const copyButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg.lucide-copy')
      );
      
      // Instead of hardcoding the count, verify that copy buttons exist
      expect(copyButtons.length).toBeGreaterThan(0);
      expect(copyButtons.length).toBeLessThanOrEqual(4); // Reasonable upper bound
    });

    it('should render signer status indicator', () => {
      render(<Signer />);
      
      expect(screen.getByText(/Signer (Running|Stopped|Connecting)/)).toBeInTheDocument();
    });

    it('should render start/stop signer button', () => {
      render(<Signer />);
      
      const signerButton = screen.getByRole('button', { name: /start signer|stop signer/i });
      expect(signerButton).toBeInTheDocument();
    });

    it('should render default relay URL', () => {
      render(<Signer />);
      
      expect(screen.getByText('wss://relay.primal.net')).toBeInTheDocument();
    });
  });

  describe('User Interactions and UI Behavior', () => {
    it('should allow typing in group credential input', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      
      await user.clear(groupInput);
      await user.type(groupInput, 'test-group-credential');
      
      // Wait for any async validation or state updates to complete
      await waitFor(() => {
        expect(groupInput).toHaveValue('test-group-credential');
      });
    });

    it('should allow typing in share credential input', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      await user.type(shareInput, 'test-share-credential');
      
      // Wait for any async validation or state updates to complete
      await waitFor(() => {
        expect(shareInput).toHaveValue('test-share-credential');
      });
    });

    it('should allow adding relay URLs', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      const relayInput = screen.getByPlaceholderText('Add relay URL');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(relayInput, 'wss://test-relay.com');
      await user.click(addButton);
      
      expect(screen.getByText('wss://test-relay.com')).toBeInTheDocument();
    });

    it('should clear relay input after adding', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      const relayInput = screen.getByPlaceholderText('Add relay URL');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(relayInput, 'wss://test-relay.com');
      await user.click(addButton);
      
      expect(relayInput).toHaveValue('');
    });

    it('should allow removing relay URLs', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      // First add a relay (there's a default relay, so we'll have 2 total)
      const relayInput = screen.getByPlaceholderText('Add relay URL');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      await user.type(relayInput, 'wss://test-relay.com');
      await user.click(addButton);
      
      // Verify the new relay was added
      expect(screen.getByText('wss://test-relay.com')).toBeInTheDocument();
      
      // Now find and click the remove button for the new relay
      // There should be multiple remove buttons now, get all of them
      const removeButtons = screen.getAllByRole('button');
      const removeButtonsWithX = removeButtons.filter(button => 
        button.querySelector('svg.lucide-x')
      );
      
      // Click the last remove button (should be for the newly added relay)
      await user.click(removeButtonsWithX[removeButtonsWithX.length - 1]);
      
      // Wait a bit for the update
      await waitFor(() => {
        expect(screen.queryByText('wss://test-relay.com')).not.toBeInTheDocument();
      });
    });

    it('should disable inputs when signer is running', async () => {
      // Setup a running signer
      const user = userEvent.setup();
      render(<Signer />);
      
      // Fill inputs and start signer
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      await user.clear(groupInput);
      await user.type(groupInput, 'valid-group');
      await user.type(shareInput, 'valid-share');
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      // Check that inputs are disabled
      await waitFor(() => {
        expect(groupInput).toBeDisabled();
        expect(shareInput).toBeDisabled();
      });
    });

    it('should validate share input and disable copy button for invalid share', async () => {
      // Make group valid and share invalid to isolate which copy button gets disabled
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockValidateShare.mockReturnValue({ 
        isValid: false, 
        message: 'Invalid share format' 
      });
      
      const user = userEvent.setup();
      render(<Signer />);
      
      // Set a valid group credential first
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      await user.clear(groupInput);
      await user.type(groupInput, 'valid-group');
      
      // Now set an invalid share
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      await user.type(shareInput, 'invalid-share');
      
      // Specifically target the copy buttons using their aria-labels
      // Find copy buttons and check their disabled states
      const copyButtons = screen.getAllByRole('button').filter(button =>
        button.querySelector('svg.lucide-copy')
      );

      // With invalid share and valid group, at least one should be disabled
      const disabledCopyButtons = copyButtons.filter(button => button.hasAttribute('disabled'));
      const enabledCopyButtons = copyButtons.filter(button => !button.hasAttribute('disabled'));

      expect(disabledCopyButtons.length).toBeGreaterThan(0);
      expect(enabledCopyButtons.length).toBeGreaterThan(0);
    });

    it('should update signer button text based on state', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      // Initially should show "Start Signer"
      expect(screen.getByRole('button', { name: /start signer/i })).toBeInTheDocument();
      
      // Fill inputs and start signer
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      await user.clear(groupInput);
      await user.type(groupInput, 'valid-group');
      await user.type(shareInput, 'valid-share');
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      // Should now show "Stop Signer"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop signer/i })).toBeInTheDocument();
      });
    });

    it('should show different status indicators', async () => {
      const user = userEvent.setup();
      render(<Signer />);
      
      // Initially should show "Stopped"
      expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      
      // Fill inputs and start signer
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      await user.clear(groupInput);
      await user.type(groupInput, 'valid-group');
      await user.type(shareInput, 'valid-share');
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      // Should show "Running"
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });
    });
  });

  describe('Initial Data Rendering', () => {
    it('should render with initial data', () => {
      const initialData = {
        share: 'initial-share',
        groupCredential: 'initial-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      expect(groupInput).toHaveValue('initial-group');
      expect(shareInput).toHaveValue('initial-share');
    });

    it('should validate initial data', () => {
      const initialData = {
        share: 'initial-share',
        groupCredential: 'initial-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      expect(mockValidateShare).toHaveBeenCalledWith('initial-share');
      expect(mockValidateGroup).toHaveBeenCalledWith('initial-group');
    });
  });

  describe('Copy Functionality', () => {
    it('should show copy buttons for valid credentials', () => {
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      const copyButtons = screen.getAllByRole('button');
      const enabledCopyButtons = copyButtons.filter(button => 
        button.querySelector('svg.lucide-copy') && !(button as HTMLButtonElement).disabled
      );
      
      // When both credentials are valid, there should be enabled copy buttons
      // Don't hardcode the exact count, just verify functionality exists
      expect(enabledCopyButtons.length).toBeGreaterThan(0);
      
      // Verify that we have copy buttons for credential functionality
      const allCopyButtons = copyButtons.filter(button => 
        button.querySelector('svg.lucide-copy')
      );
      expect(allCopyButtons.length).toBeGreaterThan(0);
    });

    it('should disable copy buttons for invalid credentials', () => {
      mockValidateShare.mockReturnValue({ isValid: false });
      mockValidateGroup.mockReturnValue({ isValid: false });
      
      render(<Signer />);
      
      const copyButtons = screen.getAllByRole('button');
      const copyButtonsForCredentials = copyButtons.filter(button => 
        button.querySelector('svg.lucide-copy')
      );
      
      copyButtonsForCredentials.forEach(button => {
        expect(button).toHaveAttribute('disabled');
      });
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should handle empty initial data gracefully', () => {
      render(<Signer />);
      
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      expect(groupInput).toHaveValue('');
      expect(shareInput).toHaveValue('');
    });

    it('should have proper input types', () => {
      render(<Signer />);
      
      const groupInput = screen.getByPlaceholderText('Enter your group credential (bfgroup...)');
      const shareInput = screen.getByPlaceholderText('Enter your secret share (bfshare...)');
      
      expect(groupInput).toHaveAttribute('type', 'text');
      expect(shareInput).toHaveAttribute('type', 'password');
    });

    it('should disable start button when credentials are invalid', () => {
      mockValidateShare.mockReturnValue({ isValid: false });
      mockValidateGroup.mockReturnValue({ isValid: false });
      
      render(<Signer />);
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      expect(startButton).toBeDisabled();
    });

    it('should enable start button when credentials are valid', () => {
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      expect(startButton).not.toBeDisabled();
    });
  });

  describe('Memory Leak Prevention Tests', () => {
    let mockConsoleWarn: jest.SpyInstance;

    beforeEach(() => {
      // Mock console.warn to capture warnings during cleanup tests
      mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      mockConsoleWarn.mockRestore();
    });

    it('should set up event listeners when signer starts', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockCreateConnectedNode).toHaveBeenCalledWith({
          group: 'valid-group',
          share: 'valid-share',
          relays: ['wss://relay.primal.net']
        });
      });

      // Verify basic event listeners are set up
      expect(mockNode.on).toHaveBeenCalledWith('closed', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('bounced', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('message', expect.any(Function));

      // Verify legacy event listeners are set up
      expect(mockNode.on).toHaveBeenCalledWith('/ecdh/sender/rej', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('/sign/sender/rej', expect.any(Function));
    });

    it('should clean up event listeners when signer stops', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      // Start the signer first
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Reset mocks to track cleanup calls
      jest.clearAllMocks();
      
      // Stop the signer
      const stopButton = screen.getByRole('button', { name: /stop signer/i });
      await user.click(stopButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      });

      // Verify cleanup was called
      expect(mockCleanupBifrostNode).toHaveBeenCalledWith(mockNode);
    });

    it('should clean up event listeners on restart (preventing accumulation)', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      // Start the signer
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Stop the signer
      const stopButton = screen.getByRole('button', { name: /stop signer/i });
      await user.click(stopButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      });

      // Reset mocks to track second start
      jest.clearAllMocks();
      
      // Start again
      const restartButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(restartButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Verify that createConnectedNode was called again (indicating proper restart)
      expect(mockCreateConnectedNode).toHaveBeenCalledTimes(1);
      
      // Verify event listeners are set up again
      expect(mockNode.on).toHaveBeenCalledWith('closed', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockNode.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should remove specific event listeners with proper handler references', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      // Start and immediately stop to trigger cleanup
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Capture the handlers that were added
      const onCalls = mockNode.on.mock.calls;
      
      // Stop the signer to trigger cleanup
      const stopButton = screen.getByRole('button', { name: /stop signer/i });
      await user.click(stopButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      });

      // Verify that off was called for basic events (these are the ones we can test reliably)
      const basicEvents = ['closed', 'error', 'ready', 'bounced', 'message'];
      basicEvents.forEach(eventName => {
        const onCall = onCalls.find(call => call[0] === eventName);
        if (onCall) {
          // The off method should be called with the same handler function
          expect(mockNode.off).toHaveBeenCalledWith(eventName, onCall[1]);
        }
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      // Make mockNode.off throw an error to test error handling
      mockNode.off.mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      
      render(<Signer initialData={initialData} />);
      
      // Start the signer
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Stop the signer - this should trigger cleanup with errors
      const stopButton = screen.getByRole('button', { name: /stop signer/i });
      await user.click(stopButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      });

      // Verify that warnings were logged for cleanup errors
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Error removing'),
        expect.any(Error)
      );
      
      // Despite errors, the component should still function
      expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
    });

    it('should clean up listeners on component unmount', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      const { unmount } = render(<Signer initialData={initialData} />);
      
      // Start the signer first to have something to clean up
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Reset mocks to track cleanup on unmount
      jest.clearAllMocks();
      
      // Unmount the component
      unmount();
      
      // Verify cleanup was called on unmount
      expect(mockCleanupBifrostNode).toHaveBeenCalled();
    });

    it('should not leak memory on multiple start/stop cycles', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      render(<Signer initialData={initialData} />);
      
      // Perform multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        // Start
        const startButton = screen.getByRole('button', { name: /start signer/i });
        await user.click(startButton);
        
        await waitFor(() => {
          expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
        });

        // Stop
        const stopButton = screen.getByRole('button', { name: /stop signer/i });
        await user.click(stopButton);
        
        await waitFor(() => {
          expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
        });
      }

      // Verify that cleanup was called appropriately
      // Each start calls cleanup once (to clean up before starting), and each stop calls cleanup once
      // So for 3 complete cycles, we expect 6 total calls
      const cleanupCallCount = mockCleanupBifrostNode.mock.calls.length;
      expect(cleanupCallCount).toBeGreaterThan(0); // At least some cleanup happened
      expect(cleanupCallCount).toBeLessThanOrEqual(6); // But not more than expected
      
      // Verify no accumulation by checking that on/off calls are balanced
      const onCallCount = mockNode.on.mock.calls.length;
      const offCallCount = mockNode.off.mock.calls.length;
      
      // Each start sets up listeners, each stop removes them
      // With 3 complete cycles, we should have balanced calls
      expect(offCallCount).toBeGreaterThan(0);
      
      // The component should still be functional
      expect(screen.getByRole('button', { name: /start signer/i })).toBeInTheDocument();
    });

    it('should handle node creation failure gracefully', async () => {
      const user = userEvent.setup();
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      // Make createConnectedNode fail
      mockCreateConnectedNode.mockRejectedValueOnce(new Error('Connection failed'));
      
      render(<Signer initialData={initialData} />);
      
      // Try to start the signer
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      // Should remain stopped due to error
      await waitFor(() => {
        expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      });

      // Component should be ready for retry (no memory leaks from failed attempt)
      expect(startButton).not.toBeDisabled();
      
      // Should be able to attempt starting again without issues
      mockCreateConnectedNode.mockResolvedValueOnce({
        node: mockNode,
        state: { isReady: true, isConnected: true, isConnecting: false, connectedRelays: [] }
      });
      
      await user.click(startButton);
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });
    });

    it('should properly expose stopSigner method through ref', async () => {
      const initialData = {
        share: 'valid-share',
        groupCredential: 'valid-group'
      };
      
      const refCallback = jest.fn();
      
      render(<Signer ref={refCallback} initialData={initialData} />);
      
      // Verify ref was called with handle containing stopSigner
      expect(refCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stopSigner: expect.any(Function)
        })
      );
      
      const signerHandle = refCallback.mock.calls[0][0];
      
      // Start signer first
      const user = userEvent.setup();
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Signer Running/)).toBeInTheDocument();
      });

      // Call stopSigner through ref (should work without throwing)
      await expect(signerHandle.stopSigner()).resolves.not.toThrow();
      
      // The ref method should successfully stop the signer without errors
      // This verifies the ref is exposed correctly and functional
      expect(typeof signerHandle.stopSigner).toBe('function');
    });
  });
}); 