import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoadShare from '../../components/LoadShare';
import '@testing-library/jest-dom';

// Mock encryption functions
const mockDeriveSecretAsync = jest.fn();
const mockDecryptPayload = jest.fn();

jest.mock('@/lib/encryption', () => ({
  derive_secret_async: (...args: unknown[]) => mockDeriveSecretAsync(...args),
  decrypt_payload: (...args: unknown[]) => mockDecryptPayload(...args),
  PBKDF2_ITERATIONS_DEFAULT: 600000,
  PBKDF2_ITERATIONS_LEGACY: 32,
  PBKDF2_ITERATIONS_V1: 100000,
  CURRENT_SHARE_VERSION: 2,
}));

describe('LoadShare Component', () => {
  const mockOnLoad = jest.fn();
  const mockOnCancel = jest.fn();

  const mockShare = {
    id: 'test-share-id',
    name: 'Test Share',
    encryptedShare: 'encrypted-data',
    salt: 'abcdef0123456789',
    groupCredential: 'bfgroup1mockgroup',
    version: 2,
  };

  const validPassword = 'TestPassword123!';

  beforeEach(() => {
    jest.clearAllMocks();
    // derive_secret_async returns a hex string (32 bytes = 64 hex chars), not Uint8Array
    mockDeriveSecretAsync.mockResolvedValue('a'.repeat(64));
    mockDecryptPayload.mockReturnValue('bfshare1mockdecryptedshare');
  });

  describe('Security Fix #44: Error Sanitization', () => {
    it('should sanitize decode errors to prevent leaking implementation details', async () => {
      const user = userEvent.setup();

      // Simulate a decode/parse error that could leak internal details
      mockDecryptPayload.mockImplementation(() => {
        throw new Error('Failed to decode bech32m: invalid character at position 5');
      });

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      // Should show sanitized error, NOT the raw "bech32m: invalid character" message
      await waitFor(() => {
        expect(screen.getByText(/Invalid credential format/i)).toBeInTheDocument();
      });

      // Should NOT show internal error details
      expect(screen.queryByText(/bech32m/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/position 5/i)).not.toBeInTheDocument();
    });

    it('should sanitize checksum errors', async () => {
      const user = userEvent.setup();

      mockDecryptPayload.mockImplementation(() => {
        throw new Error('bech32 checksum verification failed');
      });

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/Credential checksum failed/i)).toBeInTheDocument();
      });
    });

    it('should sanitize encryption/decryption errors', async () => {
      const user = userEvent.setup();

      mockDecryptPayload.mockImplementation(() => {
        throw new Error('AES-GCM decryption failed: tag mismatch');
      });

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/Encryption\/decryption operation failed/i)).toBeInTheDocument();
      });

      // Should NOT expose AES-GCM implementation details
      expect(screen.queryByText(/AES-GCM/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/tag mismatch/i)).not.toBeInTheDocument();
    });

    it('should sanitize length/size errors', async () => {
      const user = userEvent.setup();

      mockDecryptPayload.mockImplementation(() => {
        throw new Error('Invalid input length: expected 32 bytes, got 16');
      });

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/Input data has invalid length/i)).toBeInTheDocument();
      });

      // Should NOT expose expected vs actual byte counts
      expect(screen.queryByText(/32 bytes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/16/i)).not.toBeInTheDocument();
    });

    it('should use generic message for unknown errors', async () => {
      const user = userEvent.setup();

      mockDecryptPayload.mockImplementation(() => {
        throw new Error('Some unexpected internal error with sensitive details');
      });

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/Operation failed\. Please check your input and try again\./i)).toBeInTheDocument();
      });

      // Should NOT expose internal error message
      expect(screen.queryByText(/unexpected internal error/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/sensitive details/i)).not.toBeInTheDocument();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      const user = userEvent.setup();

      mockDecryptPayload.mockImplementation(() => {
        throw 'String exception that is not an Error object';
      });

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
      });
    });
  });

  describe('Basic Functionality', () => {
    it('should render the share name in header', () => {
      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('heading', { name: /Load Share/i })).toBeInTheDocument();
      expect(screen.getByText('(Test Share)')).toBeInTheDocument();
    });

    it('should successfully load share with correct password', async () => {
      const user = userEvent.setup();

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(mockOnLoad).toHaveBeenCalledWith('bfshare1mockdecryptedshare', 'bfgroup1mockgroup');
      });
    });

    it('should show invalid password error for wrong decryption', async () => {
      const user = userEvent.setup();

      // Return something that doesn't start with 'bfshare'
      mockDecryptPayload.mockReturnValue('garbled-data-not-a-share');

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid password or corrupted share data/i)).toBeInTheDocument();
      });
    });

    it('should use correct iteration count for legacy shares (no version)', async () => {
      const user = userEvent.setup();

      const legacyShare = { ...mockShare, version: undefined };

      render(
        <LoadShare
          share={legacyShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        // Should use PBKDF2_ITERATIONS_LEGACY (32)
        expect(mockDeriveSecretAsync).toHaveBeenCalledWith(validPassword, legacyShare.salt, 32);
      });
    });

    it('should use correct iteration count for v1 shares', async () => {
      const user = userEvent.setup();

      const v1Share = { ...mockShare, version: 1 };

      render(
        <LoadShare
          share={v1Share}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        // Should use PBKDF2_ITERATIONS_V1 (100000)
        expect(mockDeriveSecretAsync).toHaveBeenCalledWith(validPassword, v1Share.salt, 100000);
      });
    });

    it('should show error for unsupported share version', async () => {
      const user = userEvent.setup();

      const futureShare = { ...mockShare, version: 999 };

      render(
        <LoadShare
          share={futureShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(screen.getByText(/Unsupported share version 999/i)).toBeInTheDocument();
        expect(screen.getByText(/Please upgrade Igloo Desktop/i)).toBeInTheDocument();
      });
    });

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup();

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should disable buttons while loading', async () => {
      const user = userEvent.setup();

      // Make decryption slow
      mockDeriveSecretAsync.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('a'.repeat(64)), 200)));

      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      await user.click(loadButton);

      // Should show loading state and disable buttons
      await waitFor(() => {
        expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
        expect(cancelButton).toBeDisabled();
      });
    });

    it('should reject excessively long passwords (DoS protection)', async () => {
      render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');

      // Use fireEvent.change instead of user.type for large strings (much faster)
      const longPassword = 'a'.repeat(65537);
      fireEvent.change(passwordInput, { target: { value: longPassword } });

      await waitFor(() => {
        expect(screen.getByText(/Input too long/i)).toBeInTheDocument();
      });

      // Load button should be disabled
      const loadButton = screen.getByRole('button', { name: /load share/i });
      expect(loadButton).toBeDisabled();
    });
  });

  describe('Race Condition Prevention (isMountedRef)', () => {
    it('should not update state after component unmounts', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Make decryption slow enough that we can unmount during it
      mockDeriveSecretAsync.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('a'.repeat(64)), 100)));

      const { unmount } = render(
        <LoadShare
          share={mockShare}
          onLoad={mockOnLoad}
          onCancel={mockOnCancel}
        />
      );

      const passwordInput = screen.getByPlaceholderText('Enter password to decrypt this share');
      await user.type(passwordInput, validPassword);

      const loadButton = screen.getByRole('button', { name: /load share/i });
      await user.click(loadButton);

      // Unmount immediately while decryption is in progress
      unmount();

      // Wait for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // onLoad should NOT have been called (component unmounted)
      expect(mockOnLoad).not.toHaveBeenCalled();

      // No React "Can't perform state update on unmounted component" warning
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Can't perform a React state update")
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
