import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Recover from '@/components/Recover';
import { validateShare, validateGroup, decodeGroup, decodeShare, recoverSecretKeyFromCredentials } from '@frostr/igloo-core';

// Helper to generate realistic 64-char hex strings for scalar values
const toScalarHex = (seed: number): string => seed.toString(16).padStart(64, '0');

// Mock the igloo-core functions
jest.mock('@frostr/igloo-core');

// Mock clipboard API
const mockClipboardWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: mockClipboardWriteText,
  },
});

const mockValidateShare = validateShare as jest.MockedFunction<typeof validateShare>;
const mockValidateGroup = validateGroup as jest.MockedFunction<typeof validateGroup>;
const mockDecodeGroup = decodeGroup as jest.MockedFunction<typeof decodeGroup>;
const mockDecodeShare = decodeShare as jest.MockedFunction<typeof decodeShare>;
const mockRecoverSecretKey = recoverSecretKeyFromCredentials as jest.MockedFunction<typeof recoverSecretKeyFromCredentials>;

describe('Recover Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Standalone Mode', () => {
    it('should render in standalone mode with instructions', () => {
      render(<Recover mode="standalone" />);

      expect(screen.getByText('How to Recover')).toBeInTheDocument();
      expect(screen.getByText(/Paste your group credential/i)).toBeInTheDocument();
      expect(screen.getByText(/The threshold will be automatically detected/i)).toBeInTheDocument();

      // Recovery requirements should NOT be shown before group is entered
      expect(screen.queryByText(/Recovery Requirements/i)).not.toBeInTheDocument();
    });

    it('should not auto-populate from storage in standalone mode', async () => {
      render(<Recover mode="standalone" />);

      // Wait a bit to ensure no auto-population happens
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
        // Check that inputs are empty (not auto-populated)
        inputs.forEach(input => {
          expect(input).toHaveValue('');
        });
      });
    });

    it('should update threshold when valid group is entered', async () => {
      // Mock valid group credential
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 3,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
          { idx: 3, pubkey: 'pk3', hidden_pn: 'hn3', binder_pn: 'bn3' },
          { idx: 4, pubkey: 'pk4', hidden_pn: 'hn4', binder_pn: 'bn4' },
          { idx: 5, pubkey: 'pk5', hidden_pn: 'hn5', binder_pn: 'bn5' },
        ],
      });

      render(<Recover mode="standalone" />);

      // Initially, recovery requirements should not be shown
      expect(screen.queryByText(/Recovery Requirements/i)).not.toBeInTheDocument();

      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        // Now recovery requirements should appear with the correct threshold
        expect(screen.getByText(/Recovery Requirements/i)).toBeInTheDocument();
        expect(screen.getByText(/You need 3 out of 5 shares/i)).toBeInTheDocument();
      });
    });

    it('should allow adding share inputs up to threshold', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
          { idx: 3, pubkey: 'pk3', hidden_pn: 'hn3', binder_pn: 'bn3' },
        ],
      });

      render(<Recover mode="standalone" />);

      // Enter valid group
      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/You need 2 out of 3 shares/i)).toBeInTheDocument();
      });

      // Should have 1 share input initially
      let shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      expect(shareInputs).toHaveLength(1);

      // Click "Add Share Input"
      const addButton = screen.getByText(/Add Share Input/i);
      fireEvent.click(addButton);

      // Should now have 2 share inputs
      shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      expect(shareInputs).toHaveLength(2);
    });

    it('should enable recovery button when threshold shares are valid', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
        ],
      });
      mockValidateShare.mockReturnValue({ isValid: true });
      mockDecodeShare.mockReturnValue({
        idx: 1,
        seckey: toScalarHex(1021),
        binder_sn: toScalarHex(1001),
        hidden_sn: toScalarHex(1011),
      });

      render(<Recover mode="standalone" />);

      // Enter valid group
      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/You need 2 out of 2 shares/i)).toBeInTheDocument();
      });

      // Add second share input
      const addButton = screen.getByText(/Add Share Input/i);
      fireEvent.click(addButton);

      // Enter valid shares
      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      fireEvent.change(shareInputs[0], { target: { value: 'bfshare1mockshare1' } });
      fireEvent.change(shareInputs[1], { target: { value: 'bfshare1mockshare2' } });

      await waitFor(() => {
        const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
        expect(recoverButton).not.toBeDisabled();
      });
    });

    it('should successfully recover nsec with valid credentials', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
        ],
      });
      mockValidateShare.mockReturnValue({ isValid: true });
      mockDecodeShare.mockReturnValue({
        idx: 1,
        seckey: toScalarHex(1021),
        binder_sn: toScalarHex(1001),
        hidden_sn: toScalarHex(1011),
      });
      mockRecoverSecretKey.mockReturnValue('nsec1mockrecoveredkey');

      render(<Recover mode="standalone" />);

      // Enter valid group
      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/You need 2 out of 2 shares/i)).toBeInTheDocument();
      });

      // Add second share input
      const addButton = screen.getByText(/Add Share Input/i);
      fireEvent.click(addButton);

      // Enter valid shares
      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      fireEvent.change(shareInputs[0], { target: { value: 'bfshare1mockshare1' } });
      fireEvent.change(shareInputs[1], { target: { value: 'bfshare1mockshare2' } });

      await waitFor(() => {
        const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
        expect(recoverButton).not.toBeDisabled();
      });

      // Click recover button
      const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
      fireEvent.click(recoverButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully recovered NSEC/i)).toBeInTheDocument();
        // SECURITY FIX #43: NSEC is now masked by default - only first 8 chars shown
        expect(screen.getByText(/nsec1moc/)).toBeInTheDocument();
        // Full NSEC should NOT be visible when masked
        expect(screen.queryByText('nsec1mockrecoveredkey')).not.toBeInTheDocument();
      });
    });
  });

  describe('Preloaded Mode', () => {
    it('should render in preloaded mode with different instructions', () => {
      render(<Recover mode="preloaded" initialShare="bfshare1mockshare" />);

      expect(screen.getByRole('heading', { name: /Recover NSEC/i })).toBeInTheDocument();
      expect(screen.queryByText('How to Recover')).not.toBeInTheDocument();
    });

    it('should accept initial share in preloaded mode', () => {
      mockValidateShare.mockReturnValue({ isValid: true });

      render(<Recover mode="preloaded" initialShare="bfshare1mockshare" />);

      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      expect(shareInputs[0]).toHaveValue('bfshare1mockshare');
    });
  });

  describe('Error Handling', () => {
    it('should display error for invalid group credential', async () => {
      mockValidateGroup.mockReturnValue({
        isValid: false,
        message: 'Invalid group format'
      });

      render(<Recover mode="standalone" />);

      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'invalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/Invalid group format/i)).toBeInTheDocument();
      });
    });

    it('should handle recovery errors gracefully', async () => {
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
        ],
      });
      mockValidateShare.mockReturnValue({ isValid: true });
      mockDecodeShare.mockReturnValue({
        idx: 1,
        seckey: toScalarHex(1021),
        binder_sn: toScalarHex(1001),
        hidden_sn: toScalarHex(1011),
      });
      mockRecoverSecretKey.mockImplementation(() => {
        throw new Error('Recovery failed');
      });

      render(<Recover mode="standalone" />);

      // Setup valid inputs
      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        const addButton = screen.getByText(/Add Share Input/i);
        fireEvent.click(addButton);
      });

      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      fireEvent.change(shareInputs[0], { target: { value: 'bfshare1mockshare1' } });
      fireEvent.change(shareInputs[1], { target: { value: 'bfshare1mockshare2' } });

      await waitFor(() => {
        const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
        fireEvent.click(recoverButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Error recovering NSEC/i)).toBeInTheDocument();
        expect(screen.getByText(/Recovery failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Fix #42: DEBUG_AUTO_POPULATE Disabled', () => {
    it('should not log sensitive share data when DEBUG_AUTO_POPULATE is false', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockValidateShare.mockReturnValue({ isValid: true });
      mockDecodeShare.mockReturnValue({
        idx: 1,
        seckey: toScalarHex(1021),
        binder_sn: toScalarHex(1001),
        hidden_sn: toScalarHex(1011),
      });
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
        ],
      });

      render(<Recover mode="standalone" />);

      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/Recovery Requirements/i)).toBeInTheDocument();
      });

      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      fireEvent.change(shareInputs[0], { target: { value: 'bfshare1mockshare1' } });

      // Wait for any async logging that might happen
      await waitFor(() => {
        expect(mockValidateShare).toHaveBeenCalled();
      });

      // SECURITY: With DEBUG_AUTO_POPULATE = false, no sensitive data should be logged
      // Check that no log contains sensitive decoded share data
      const sensitivePatterns = [
        'secret-key-data',
        'Share decoded',
        'Found matching group',
        'Checking for stored shares',
        'Found recent share',
        'Decoded share',
      ];

      consoleSpy.mock.calls.forEach(call => {
        const logMessage = call.join(' ');
        sensitivePatterns.forEach(pattern => {
          expect(logMessage).not.toContain(pattern);
        });
      });

      consoleSpy.mockRestore();
    });

    it('should not auto-populate from storage in standalone mode (debug-independent)', async () => {
      render(<Recover mode="standalone" />);

      // In standalone mode, inputs should remain empty regardless of DEBUG flag
      await waitFor(() => {
        const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
        expect(groupInput).toHaveValue('');
      });
    });
  });

  describe('Security Fix #43: Secure NSEC Display', () => {
    // Helper to set up a successful recovery
    const setupSuccessfulRecovery = async () => {
      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
        ],
      });
      mockValidateShare.mockReturnValue({ isValid: true });
      mockDecodeShare.mockReturnValue({
        idx: 1,
        seckey: toScalarHex(1021),
        binder_sn: toScalarHex(1001),
        hidden_sn: toScalarHex(1011),
      });
      mockRecoverSecretKey.mockReturnValue('nsec1abcdefghijklmnopqrstuvwxyz123456789');

      render(<Recover mode="standalone" />);

      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/Recovery Requirements/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/Add Share Input/i);
      fireEvent.click(addButton);

      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      fireEvent.change(shareInputs[0], { target: { value: 'bfshare1mockshare1' } });
      fireEvent.change(shareInputs[1], { target: { value: 'bfshare1mockshare2' } });

      await waitFor(() => {
        const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
        expect(recoverButton).not.toBeDisabled();
      });

      const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
      fireEvent.click(recoverButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully recovered NSEC/i)).toBeInTheDocument();
      });
    };

    it('should display NSEC masked by default (only first 8 chars visible)', async () => {
      await setupSuccessfulRecovery();

      // Should show masked version with dots
      expect(screen.getByText(/nsec1abc/)).toBeInTheDocument();
      expect(screen.getByText(/•{40}/)).toBeInTheDocument();

      // Full NSEC should NOT be visible
      expect(screen.queryByText('nsec1abcdefghijklmnopqrstuvwxyz123456789')).not.toBeInTheDocument();
    });

    it('should show security warning when NSEC is displayed', async () => {
      await setupSuccessfulRecovery();

      expect(screen.getByText(/Security Warning/i)).toBeInTheDocument();
      expect(screen.getByText(/auto-clear in 60 seconds/i)).toBeInTheDocument();
      expect(screen.getByText(/Do not screenshot/i)).toBeInTheDocument();
    });

    it('should have Copy to Clipboard button', async () => {
      await setupSuccessfulRecovery();

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('should copy NSEC to clipboard when Copy button clicked', async () => {
      await setupSuccessfulRecovery();

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboardWriteText).toHaveBeenCalledWith('nsec1abcdefghijklmnopqrstuvwxyz123456789');
      });

      // Should show "Copied!" feedback
      await waitFor(() => {
        expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
      });
    });

    it('should show error feedback when clipboard copy fails', async () => {
      // Make clipboard fail
      mockClipboardWriteText.mockRejectedValueOnce(new Error('Clipboard access denied'));

      await setupSuccessfulRecovery();

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      fireEvent.click(copyButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Failed to copy/i)).toBeInTheDocument();
      });

      // Should NOT show "Copied!" feedback
      expect(screen.queryByText(/Copied!/i)).not.toBeInTheDocument();
    });

    it('should have Reveal/Hide toggle button', async () => {
      await setupSuccessfulRecovery();

      const revealButton = screen.getByRole('button', { name: /Reveal/i });
      expect(revealButton).toBeInTheDocument();
    });

    it('should reveal full NSEC when Reveal button clicked', async () => {
      await setupSuccessfulRecovery();

      const revealButton = screen.getByRole('button', { name: /Reveal/i });
      fireEvent.click(revealButton);

      await waitFor(() => {
        // Full NSEC should now be visible
        expect(screen.getByText('nsec1abcdefghijklmnopqrstuvwxyz123456789')).toBeInTheDocument();
        // Hide button should appear
        expect(screen.getByRole('button', { name: /Hide/i })).toBeInTheDocument();
      });
    });

    it('should hide NSEC when Hide button clicked after reveal', async () => {
      await setupSuccessfulRecovery();

      // First reveal
      const revealButton = screen.getByRole('button', { name: /Reveal/i });
      fireEvent.click(revealButton);

      await waitFor(() => {
        expect(screen.getByText('nsec1abcdefghijklmnopqrstuvwxyz123456789')).toBeInTheDocument();
      });

      // Then hide
      const hideButton = screen.getByRole('button', { name: /Hide/i });
      fireEvent.click(hideButton);

      await waitFor(() => {
        // Full NSEC should be hidden again
        expect(screen.queryByText('nsec1abcdefghijklmnopqrstuvwxyz123456789')).not.toBeInTheDocument();
        // Masked version should show
        expect(screen.getByText(/nsec1abc/)).toBeInTheDocument();
      });
    });

    it('should have Clear button to remove NSEC from memory', async () => {
      await setupSuccessfulRecovery();

      const clearButton = screen.getByRole('button', { name: /Clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should clear NSEC when Clear button clicked', async () => {
      await setupSuccessfulRecovery();

      const clearButton = screen.getByRole('button', { name: /Clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        // NSEC display area should be gone
        expect(screen.queryByText(/nsec1abc/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Security Warning/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Copy to Clipboard/i })).not.toBeInTheDocument();
      });
    });

    it('should auto-clear NSEC after timeout', async () => {
      jest.useFakeTimers();

      await setupSuccessfulRecovery();

      // NSEC should be visible
      expect(screen.getByText(/nsec1abc/)).toBeInTheDocument();

      // Fast-forward 60 seconds
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        // NSEC should be cleared
        expect(screen.queryByText(/nsec1abc/)).not.toBeInTheDocument();
        // Should show message about auto-clear
        expect(screen.getByText(/NSEC has been cleared from memory/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should clean up timeout on unmount', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      mockValidateGroup.mockReturnValue({ isValid: true });
      mockDecodeGroup.mockReturnValue({
        threshold: 2,
        group_pk: 'mock-group-pk',
        commits: [
          { idx: 1, pubkey: 'pk1', hidden_pn: 'hn1', binder_pn: 'bn1' },
          { idx: 2, pubkey: 'pk2', hidden_pn: 'hn2', binder_pn: 'bn2' },
        ],
      });
      mockValidateShare.mockReturnValue({ isValid: true });
      mockDecodeShare.mockReturnValue({
        idx: 1,
        seckey: toScalarHex(1021),
        binder_sn: toScalarHex(1001),
        hidden_sn: toScalarHex(1011),
      });
      mockRecoverSecretKey.mockReturnValue('nsec1test');

      const { unmount } = render(<Recover mode="standalone" />);

      const groupInput = screen.getByPlaceholderText(/Enter bfgroup1/i);
      fireEvent.change(groupInput, { target: { value: 'bfgroup1mockvalidgroup' } });

      await waitFor(() => {
        expect(screen.getByText(/Recovery Requirements/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/Add Share Input/i);
      fireEvent.click(addButton);

      const shareInputs = screen.getAllByPlaceholderText(/Enter share/i);
      fireEvent.change(shareInputs[0], { target: { value: 'bfshare1mockshare1' } });
      fireEvent.change(shareInputs[1], { target: { value: 'bfshare1mockshare2' } });

      await waitFor(() => {
        const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
        expect(recoverButton).not.toBeDisabled();
      });

      const recoverButton = screen.getByRole('button', { name: /Recover NSEC/i });
      fireEvent.click(recoverButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully recovered NSEC/i)).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify clearTimeout was called for cleanup
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should NOT expose NSEC in DOM when masked', async () => {
      await setupSuccessfulRecovery();

      // Get the entire document body HTML
      const bodyHtml = document.body.innerHTML;

      // The full NSEC should NOT appear anywhere in the DOM when masked
      expect(bodyHtml).not.toContain('nsec1abcdefghijklmnopqrstuvwxyz123456789');
    });
  });
});
