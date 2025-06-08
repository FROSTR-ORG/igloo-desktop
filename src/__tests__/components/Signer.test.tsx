import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
  };

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
      node: mockNode as any, // Mock node for testing
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
      const groupCopyButton = screen.getByLabelText('Copy group credential');
      const shareCopyButton = screen.getByLabelText('Copy secret share');
      
      // Assert specific button states: share button disabled, group button enabled
      expect(shareCopyButton).toBeDisabled();
      expect(groupCopyButton).not.toBeDisabled();
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
}); 