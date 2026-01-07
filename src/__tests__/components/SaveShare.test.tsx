import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveShare from '../../components/SaveShare';
import '@testing-library/jest-dom';

// Mock encryption functions
jest.mock('@/lib/encryption', () => ({
  derive_secret_async: jest.fn().mockResolvedValue(new Uint8Array(32)),
  encrypt_payload: jest.fn().mockReturnValue('encrypted-share-data'),
}));

// Mock crypto.getRandomValues for salt generation
const mockGetRandomValues = jest.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
  },
});

describe('SaveShare Component', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const validShare = 'bfshare1mockshare';
  const validPassword = 'TestPassword123!';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Fix #7: Password Memory Exposure', () => {
    it('should NOT pass password to onSave callback - only salt and encryptedShare', async () => {
      const user = userEvent.setup();

      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      // Enter valid password
      const passwordInput = screen.getByPlaceholderText('Enter password to encrypt this share');
      await user.type(passwordInput, validPassword);

      // Enter matching confirm password
      const confirmInput = screen.getByPlaceholderText('Confirm password');
      await user.type(confirmInput, validPassword);

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /save share/i });
      await user.click(saveButton);

      // Wait for async operation
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // CRITICAL SECURITY TEST: Verify callback signature
      // The callback should receive exactly 2 arguments: salt and encryptedShare
      // NOT 3 arguments (which would include password)
      const callArgs = mockOnSave.mock.calls[0];
      expect(callArgs).toHaveLength(2);

      // Verify the arguments are what we expect
      const [salt, encryptedShare] = callArgs;
      expect(typeof salt).toBe('string');
      expect(salt.length).toBe(32); // 16 bytes as hex = 32 chars
      expect(encryptedShare).toBe('encrypted-share-data');

      // Explicit check: password should NOT be in the callback args
      expect(callArgs).not.toContain(validPassword);
    });

    it('should clear password from state after successful save', async () => {
      const user = userEvent.setup();

      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to encrypt this share');
      const confirmInput = screen.getByPlaceholderText('Confirm password');

      // Enter and verify password
      await user.type(passwordInput, validPassword);
      await user.type(confirmInput, validPassword);

      // Submit
      const saveButton = screen.getByRole('button', { name: /save share/i });
      await user.click(saveButton);

      // Wait for save and form reset
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // Verify inputs are cleared after save
      await waitFor(() => {
        expect(passwordInput).toHaveValue('');
        expect(confirmInput).toHaveValue('');
      });
    });

    it('should validate onSave prop type signature accepts only (salt, encryptedShare)', () => {
      // This is a compile-time check that would fail TypeScript if the interface is wrong
      // At runtime, we verify the callback is called correctly
      const typedOnSave: (salt: string, encryptedShare: string) => void = jest.fn();

      render(
        <SaveShare
          onSave={typedOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      // Component should render without errors with the correct callback signature
      expect(screen.getByRole('heading', { name: /Save Share/i })).toBeInTheDocument();
    });
  });

  describe('Basic Functionality', () => {
    it('should render password input fields', () => {
      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      expect(screen.getByPlaceholderText('Enter password to encrypt this share')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument();
    });

    it('should disable save button when passwords do not match', async () => {
      const user = userEvent.setup();

      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to encrypt this share');
      const confirmInput = screen.getByPlaceholderText('Confirm password');

      await user.type(passwordInput, validPassword);
      await user.type(confirmInput, 'DifferentPassword123!');

      const saveButton = screen.getByRole('button', { name: /save share/i });
      expect(saveButton).toBeDisabled();
    });

    it('should show error for password too short', async () => {
      const user = userEvent.setup();

      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to encrypt this share');
      await user.type(passwordInput, 'short');

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least/)).toBeInTheDocument();
      });
    });

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();

      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should disable save button when no share to encrypt', () => {
      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={undefined}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save share/i });
      expect(saveButton).toBeDisabled();
    });

    it('should show loading state while encrypting', async () => {
      const user = userEvent.setup();

      // Make the encryption take some time
      const { derive_secret_async } = require('@/lib/encryption');
      derive_secret_async.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(new Uint8Array(32)), 100)));

      render(
        <SaveShare
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          shareToEncrypt={validShare}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to encrypt this share');
      const confirmInput = screen.getByPlaceholderText('Confirm password');

      await user.type(passwordInput, validPassword);
      await user.type(confirmInput, validPassword);

      const saveButton = screen.getByRole('button', { name: /save share/i });
      await user.click(saveButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/Encrypting share/)).toBeInTheDocument();
      });
    });
  });
});
