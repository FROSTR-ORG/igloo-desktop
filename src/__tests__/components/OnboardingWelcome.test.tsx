import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingWelcome } from '../../components/OnboardingWelcome';

describe('OnboardingWelcome Component', () => {
  const mockOnGetStarted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the welcome title', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText('Welcome to Igloo Desktop')).toBeInTheDocument();
    });

    it('should render the subtitle', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText('FROSTR keyset manager and remote signer')).toBeInTheDocument();
    });

    it('should render the About section', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText('About')).toBeInTheDocument();
      expect(screen.getByText(/Igloo Desktop is one of only two apps/)).toBeInTheDocument();
      expect(screen.getByText(/that can create FROSTR keysets/)).toBeInTheDocument();
    });

    it('should render the How It Works section', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText(/Create a keyset by providing a Nostr private key/)).toBeInTheDocument();
      expect(screen.getByText(/Choose how many shares to create/)).toBeInTheDocument();
      expect(screen.getByText(/Save shares to this device/)).toBeInTheDocument();
      expect(screen.getByText(/Run signing nodes that work together/)).toBeInTheDocument();
    });

    it('should render the Getting Started section', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('New to FROSTR?')).toBeInTheDocument();
      expect(screen.getByText('Have a share?')).toBeInTheDocument();
    });

    it('should render the Get Started button', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
    });
  });

  describe('External Links', () => {
    it('should render igloo-cli link in About section', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const link = screen.getByRole('link', { name: /igloo-cli/i });
      expect(link).toHaveAttribute('href', 'https://www.npmjs.com/package/@frostr/igloo-cli');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render Frost2x link with NIP-07 label', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const link = screen.getByRole('link', { name: /Frost2x.*NIP-07/i });
      expect(link).toHaveAttribute('href', 'https://github.com/FROSTR-ORG/frost2x');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render igloo-server link with NIP-46 label', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const link = screen.getByRole('link', { name: /igloo-server.*NIP-46/i });
      expect(link).toHaveAttribute('href', 'https://github.com/FROSTR-ORG/igloo-server');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render igloo-android link with NIP-55 label', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const link = screen.getByRole('link', { name: /igloo-android.*NIP-55/i });
      expect(link).toHaveAttribute('href', 'https://github.com/FROSTR-ORG/igloo-android');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render View all FROSTR apps link', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const link = screen.getByRole('link', { name: /View all FROSTR apps/i });
      expect(link).toHaveAttribute('href', 'https://frostr.org');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Button Interaction', () => {
    it('should call onGetStarted when Get Started button is clicked', async () => {
      const user = userEvent.setup();
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const button = screen.getByRole('button', { name: /Get Started/i });
      await user.click(button);

      expect(mockOnGetStarted).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible headings structure', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      // Main title is h2
      const title = screen.getByText('Welcome to Igloo Desktop');
      expect(title.tagName).toBe('H2');

      // Section headers are h3
      const aboutHeader = screen.getByText('About');
      expect(aboutHeader.tagName).toBe('H3');

      const howItWorksHeader = screen.getByText('How It Works');
      expect(howItWorksHeader.tagName).toBe('H3');

      const gettingStartedHeader = screen.getByText('Getting Started');
      expect(gettingStartedHeader.tagName).toBe('H3');

      const usingKeysetHeader = screen.getByText('Using Your Keyset');
      expect(usingKeysetHeader.tagName).toBe('H3');
    });

    it('should use ordered list for How It Works steps', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      const list = screen.getByRole('list');
      expect(list.tagName).toBe('OL');
    });
  });

  describe('Using Your Keyset Section', () => {
    it('should render the Using Your Keyset section', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText('Using Your Keyset')).toBeInTheDocument();
      expect(screen.getByText(/To sign into Nostr clients/)).toBeInTheDocument();
    });

    it('should explain that igloo-desktop creates keysets and runs as signer', () => {
      render(<OnboardingWelcome onGetStarted={mockOnGetStarted} />);

      expect(screen.getByText(/Igloo Desktop creates keysets and runs as a signer/)).toBeInTheDocument();
    });
  });
});
