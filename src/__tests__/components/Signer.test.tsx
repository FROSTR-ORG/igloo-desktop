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
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns for UI tests
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

  describe('Component Rendering and UI Elements', () => {
    it('should render the main heading', () => {
      render(<Signer />);
      
      expect(screen.getByText('Start your signer to handle requests')).toBeInTheDocument();
    });

    it('should render group credential input field', () => {
      render(<Signer />);
      
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      
      expect(groupInput).toBeInTheDocument();
    });

    it('should render share credential password input field', () => {
      const { container } = render(<Signer />);
      
      const passwordInput = container.querySelector('input[type="password"]');
      
      expect(passwordInput).toBeInTheDocument();
    });

    it('should render relay URL section', () => {
      render(<Signer />);
      
      expect(screen.getByText('Relay URLs')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add relay URL')).toBeInTheDocument();
    });

    it('should render copy buttons for credentials', () => {
      render(<Signer />);
      
      const copyButtons = screen.getAllByRole('button');
      const copyButtonsForCredentials = copyButtons.filter(button => 
        button.querySelector('svg.lucide-copy')
      );
      
      expect(copyButtonsForCredentials).toHaveLength(2); // One for group, one for share
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
      
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'test-group-credential');
      
      expect(groupInput).toHaveValue('test-group-credential');
    });

    it('should allow typing in share credential input', async () => {
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.type(passwordInput!, 'test-share-credential');
      
      expect(passwordInput).toHaveValue('test-share-credential');
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
      
      // Check that inputs are disabled
      await waitFor(() => {
        expect(groupInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
      });
    });

    it('should show validation errors in UI', async () => {
      mockValidateShare.mockReturnValue({ 
        isValid: false, 
        message: 'Invalid share format' 
      } as any);
      
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      const passwordInput = container.querySelector('input[type="password"]');
      await user.type(passwordInput!, 'invalid-share');
      
      await waitFor(() => {
        expect(screen.getByText('Invalid share format')).toBeInTheDocument();
      });
    });

    it('should update signer button text based on state', async () => {
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      // Initially should show "Start Signer"
      expect(screen.getByRole('button', { name: /start signer/i })).toBeInTheDocument();
      
      // Fill inputs and start signer
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'valid-group');
      await user.type(passwordInput!, 'valid-share');
      
      const startButton = screen.getByRole('button', { name: /start signer/i });
      await user.click(startButton);
      
      // Should now show "Stop Signer"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop signer/i })).toBeInTheDocument();
      });
    });

    it('should show different status indicators', async () => {
      const user = userEvent.setup();
      const { container } = render(<Signer />);
      
      // Initially should show "Stopped"
      expect(screen.getByText(/Signer Stopped/)).toBeInTheDocument();
      
      // Fill inputs and start signer
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      const passwordInput = container.querySelector('input[type="password"]');
      
      await user.clear(groupInput!);
      await user.type(groupInput!, 'valid-group');
      await user.type(passwordInput!, 'valid-share');
      
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
      
      const { container } = render(<Signer initialData={initialData} />);
      
      const inputs = screen.getAllByRole('textbox');
      const groupInput = inputs.find(input => input.getAttribute('type') === 'text' && !input.getAttribute('placeholder'));
      const passwordInput = container.querySelector('input[type="password"]');
      
      expect(groupInput).toHaveValue('initial-group');
      expect(passwordInput).toHaveValue('initial-share');
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
        button.querySelector('svg.lucide-copy') && !button.disabled
      );
      
      expect(enabledCopyButtons).toHaveLength(2);
    });

    it('should disable copy buttons for invalid credentials', () => {
      mockValidateShare.mockReturnValue({ isValid: false } as any);
      mockValidateGroup.mockReturnValue({ isValid: false } as any);
      
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
}); 