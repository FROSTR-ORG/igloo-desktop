// Setup Buff mock before any imports
import { setupBuffMock } from '../__mocks__/buff.mock';
setupBuffMock();

// Mock dependencies before component imports
jest.mock('@frostr/igloo-core');
jest.mock('@/lib/clientShareManager');
jest.mock('@/lib/encryption');

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddShare from '@/components/AddShare';
import { validateGroup, decodeGroup, validateShare, decodeShare } from '@frostr/igloo-core';
import { clientShareManager } from '@/lib/clientShareManager';
import { derive_secret_async, encrypt_payload } from '@/lib/encryption';

const mockValidateGroup = validateGroup as jest.MockedFunction<typeof validateGroup>;
const mockDecodeGroup = decodeGroup as jest.MockedFunction<typeof decodeGroup>;
const mockValidateShare = validateShare as jest.MockedFunction<typeof validateShare>;
const mockDecodeShare = decodeShare as jest.MockedFunction<typeof decodeShare>;
const mockGetShares = clientShareManager.getShares as jest.MockedFunction<typeof clientShareManager.getShares>;
const mockSaveShare = clientShareManager.saveShare as jest.MockedFunction<typeof clientShareManager.saveShare>;
const mockDeriveSecretAsync = derive_secret_async as jest.MockedFunction<typeof derive_secret_async>;
const mockEncryptPayload = encrypt_payload as jest.MockedFunction<typeof encrypt_payload>;

describe('AddShare', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  const mockDecodedGroup = {
    threshold: 2,
    group_pk: 'mock-group-pk',
    commits: [
      { idx: 0, pubkey: 'pubkey0', hidden_pn: 'hidden0', binder_pn: 'binder0' },
      { idx: 1, pubkey: 'pubkey1', hidden_pn: 'hidden1', binder_pn: 'binder1' },
      { idx: 2, pubkey: 'pubkey2', hidden_pn: 'hidden2', binder_pn: 'binder2' },
    ],
  };

  const mockDecodedShare = {
    binder_sn: 'abc12345678',
    hidden_sn: 'hidden-sn',
    idx: 1,
    seckey: 'seckey',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetShares.mockResolvedValue([]);

    // Mock encryption functions
    mockDeriveSecretAsync.mockResolvedValue('mock-secret');
    mockEncryptPayload.mockReturnValue('mock-encrypted');
  });

  it('renders step 1 (group credential input) initially', () => {
    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText(/add/i)).toBeInTheDocument();
    expect(screen.getAllByText(/group credential/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/bfgroup/i)).toBeInTheDocument();
  });

  it('validates and decodes group credential', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const groupInput = screen.getByPlaceholderText(/bfgroup/i);
    fireEvent.change(groupInput, { target: { value: 'bfgroup1test' } });

    await waitFor(() => {
      expect(mockValidateGroup).toHaveBeenCalledWith('bfgroup1test');
      expect(mockDecodeGroup).toHaveBeenCalledWith('bfgroup1test');
    });

    // Should show group details
    await waitFor(() => {
      expect(screen.getByText(/group details/i)).toBeInTheDocument();
      expect(screen.getByText(/threshold:/i)).toBeInTheDocument();
      // Check that the decoded threshold is displayed
      const thresholdElements = screen.getAllByText('2');
      expect(thresholdElements.length).toBeGreaterThan(0);
    });
  });

  it('shows error for invalid group credential', async () => {
    mockValidateGroup.mockReturnValue({ isValid: false, message: 'Invalid group format' });

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const groupInput = screen.getByPlaceholderText(/bfgroup/i);
    fireEvent.change(groupInput, { target: { value: 'invalid' } });

    await waitFor(() => {
      expect(screen.getByText(/invalid group format/i)).toBeInTheDocument();
    });

    // Next button should be disabled
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('advances to step 2 after valid group credential', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const groupInput = screen.getByPlaceholderText(/bfgroup/i);
    fireEvent.change(groupInput, { target: { value: 'bfgroup1test' } });

    await waitFor(() => {
      expect(screen.getByText(/group details/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getAllByText(/share credential/i).length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText(/bfshare/i)).toBeInTheDocument();
    });
  });

  it('validates and decodes share credential in step 2', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue(mockDecodedShare);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Step 1: Enter group
    const groupInput = screen.getByPlaceholderText(/bfgroup/i);
    fireEvent.change(groupInput, { target: { value: 'bfgroup1test' } });

    await waitFor(() => {
      expect(screen.getByText(/group details/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: Enter share
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/bfshare/i)).toBeInTheDocument();
    });

    const shareInput = screen.getByPlaceholderText(/bfshare/i);
    fireEvent.change(shareInput, { target: { value: 'bfshare1test' } });

    await waitFor(() => {
      expect(mockValidateShare).toHaveBeenCalledWith('bfshare1test');
      expect(mockDecodeShare).toHaveBeenCalledWith('bfshare1test');
    });

    // Should show share details
    await waitFor(() => {
      expect(screen.getByText(/share details/i)).toBeInTheDocument();
      expect(screen.getByText(/index:/i)).toBeInTheDocument();
    });
  });

  it('shows error when share index does not belong to group', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue({ ...mockDecodedShare, idx: 99 }); // Invalid index

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Step 1
    const groupInput = screen.getByPlaceholderText(/bfgroup/i);
    fireEvent.change(groupInput, { target: { value: 'bfgroup1test' } });
    await waitFor(() => screen.getByText(/group details/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2
    await waitFor(() => screen.getByPlaceholderText(/bfshare/i));
    const shareInput = screen.getByPlaceholderText(/bfshare/i);
    fireEvent.change(shareInput, { target: { value: 'bfshare1test' } });

    await waitFor(() => {
      expect(screen.getByText(/share index 99 does not belong to this group/i)).toBeInTheDocument();
    });
  });

  it('advances to step 3 (save) after valid share', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue(mockDecodedShare);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText(/bfgroup/i), { target: { value: 'bfgroup1test' } });
    await waitFor(() => screen.getByText(/group details/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2
    await waitFor(() => screen.getByPlaceholderText(/bfshare/i));
    fireEvent.change(screen.getByPlaceholderText(/bfshare/i), { target: { value: 'bfshare1test' } });
    await waitFor(() => screen.getByText(/share details/i));
    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0]);

    // Step 3
    await waitFor(() => {
      expect(screen.getByText(/provide a name and password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e.g., Share 1/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter password to encrypt this share/i)).toBeInTheDocument();
    });
  });

  it('saves share with valid inputs in step 3', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue(mockDecodedShare);
    mockSaveShare.mockResolvedValue(true);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Navigate to step 3
    fireEvent.change(screen.getByPlaceholderText(/bfgroup/i), { target: { value: 'bfgroup1test' } });
    await waitFor(() => screen.getByText(/group details/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByPlaceholderText(/bfshare/i));
    fireEvent.change(screen.getByPlaceholderText(/bfshare/i), { target: { value: 'bfshare1test' } });
    await waitFor(() => screen.getByText(/share details/i));
    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0]);

    // Fill in step 3
    await waitFor(() => screen.getByPlaceholderText(/e.g., Share 1/i));

    const nameInput = screen.getByPlaceholderText(/e.g., Share 1/i);
    fireEvent.change(nameInput, { target: { value: 'My Test Share' } });

    const passwordInput = screen.getByPlaceholderText(/Enter password to encrypt this share/i);
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const confirmInput = screen.getByPlaceholderText(/Confirm password/i);
    fireEvent.change(confirmInput, { target: { value: 'password123' } });

    // Click save
    const saveButton = screen.getByRole('button', { name: /^add$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveShare).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('shows error when passwords do not match', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue(mockDecodedShare);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Navigate to step 3
    fireEvent.change(screen.getByPlaceholderText(/bfgroup/i), { target: { value: 'bfgroup1test' } });
    await waitFor(() => screen.getByText(/group details/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByPlaceholderText(/bfshare/i));
    fireEvent.change(screen.getByPlaceholderText(/bfshare/i), { target: { value: 'bfshare1test' } });
    await waitFor(() => screen.getByText(/share details/i));
    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0]);

    await waitFor(() => screen.getByPlaceholderText(/e.g., Share 1/i));

    fireEvent.change(screen.getByPlaceholderText(/e.g., Share 1/i), { target: { value: 'Test Share' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter password to encrypt this share/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText(/Confirm password/i), { target: { value: 'different' } });

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /^add$/i });
    expect(saveButton).toBeDisabled();
  });

  it('detects duplicate share names', async () => {
    mockGetShares.mockResolvedValue([
      {
        id: 'existing-share',
        name: 'Existing Share',
        share: 'encrypted',
        salt: 'salt',
        groupCredential: 'group',
      },
    ]);

    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue(mockDecodedShare);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Navigate to step 3
    fireEvent.change(screen.getByPlaceholderText(/bfgroup/i), { target: { value: 'bfgroup1test' } });
    await waitFor(() => screen.getByText(/group details/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByPlaceholderText(/bfshare/i));
    fireEvent.change(screen.getByPlaceholderText(/bfshare/i), { target: { value: 'bfshare1test' } });
    await waitFor(() => screen.getByText(/share details/i));
    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0]);

    await waitFor(() => screen.getByPlaceholderText(/e.g., Share 1/i));

    // Try to use existing name
    fireEvent.change(screen.getByPlaceholderText(/e.g., Share 1/i), { target: { value: 'Existing Share' } });

    await waitFor(() => {
      expect(screen.getByText(/a share with this name already exists/i)).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('allows navigating back through steps', async () => {
    mockValidateGroup.mockReturnValue({ isValid: true });
    mockDecodeGroup.mockReturnValue(mockDecodedGroup);
    mockValidateShare.mockReturnValue({ isValid: true });
    mockDecodeShare.mockReturnValue(mockDecodedShare);

    render(<AddShare onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Go to step 2
    fireEvent.change(screen.getByPlaceholderText(/bfgroup/i), { target: { value: 'bfgroup1test' } });
    await waitFor(() => screen.getByText(/group details/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByPlaceholderText(/bfshare/i));

    // Go back to step 1
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/bfgroup/i)).toBeInTheDocument();
    });
  });
});
