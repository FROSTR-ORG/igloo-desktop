import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Recover from '@/components/Recover';
import { validateShare, validateGroup, decodeGroup, decodeShare, recoverSecretKeyFromCredentials } from '@frostr/igloo-core';

// Mock the igloo-core functions
jest.mock('@frostr/igloo-core');

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
        seckey: 'mockseckey',
        binder_sn: 'mockbinder',
        hidden_sn: 'mockhidden',
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
        seckey: 'mockseckey',
        binder_sn: 'mockbinder',
        hidden_sn: 'mockhidden',
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
        expect(screen.getByText('nsec1mockrecoveredkey')).toBeInTheDocument();
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
        seckey: 'mockseckey',
        binder_sn: 'mockbinder',
        hidden_sn: 'mockhidden',
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
});
