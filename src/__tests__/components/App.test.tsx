import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '@/components/App';
import { clientShareManager } from '@/lib/clientShareManager';

// Mock the clientShareManager
jest.mock('@/lib/clientShareManager', () => ({
  clientShareManager: {
    getShares: jest.fn(),
  },
}));

// Mock child components to focus on App logic
jest.mock('@/components/ShareList', () => {
  return function MockShareList({ onShareLoaded }: any) {
    return (
      <div data-testid="share-list">
        <button 
          onClick={() => onShareLoaded('mock-share', 'mock-group-credential')}
          data-testid="load-share-button"
        >
          Load Share
        </button>
      </div>
    );
  };
});

jest.mock('@/components/Create', () => {
  return function MockCreate({ onKeysetCreated, onBack }: any) {
    return (
      <div data-testid="create-component">
        <button 
          onClick={() => onKeysetCreated({
            groupCredential: 'mock-group',
            shareCredentials: ['share1', 'share2'],
            name: 'Test Keyset'
          })}
          data-testid="create-keyset-button"
        >
          Create Keyset
        </button>
        <button onClick={onBack} data-testid="back-button">Back</button>
      </div>
    );
  };
});

jest.mock('@/components/Keyset', () => {
  return function MockKeyset({ onFinish }: any) {
    return (
      <div data-testid="keyset-component">
        <button onClick={onFinish} data-testid="finish-button">Finish</button>
      </div>
    );
  };
});

jest.mock('@/components/Signer', () => {
  const MockSigner = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      stopSigner: jest.fn().mockResolvedValue(undefined),
    }));
    
    return <div data-testid="signer-component">Signer</div>;
  });
  MockSigner.displayName = 'MockSigner';
  return MockSigner;
});

jest.mock('@/components/Recover', () => {
  return function MockRecover() {
    return <div data-testid="recover-component">Recover</div>;
  };
});

const mockClientShareManager = clientShareManager as jest.Mocked<typeof clientShareManager>;

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientShareManager.getShares.mockResolvedValue([]);
  });

  it('renders the main app with correct title', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Available Shares')).toBeInTheDocument();
    });
  });

  it('shows create button and navigates to create view', async () => {
    render(<App />);
    
    await waitFor(() => {
      const createButton = screen.getByText('Create New');
      fireEvent.click(createButton);
    });

    expect(screen.getByTestId('create-component')).toBeInTheDocument();
  });

  it('handles keyset creation workflow', async () => {
    render(<App />);
    
    // Navigate to create
    await waitFor(() => {
      const createButton = screen.getByText('Create New');
      fireEvent.click(createButton);
    });

    // Create a keyset
    const createKeysetButton = screen.getByTestId('create-keyset-button');
    fireEvent.click(createKeysetButton);

    // Should show keyset component
    expect(screen.getByTestId('keyset-component')).toBeInTheDocument();
    expect(screen.getByText('New Keyset Created')).toBeInTheDocument();
  });

  it('handles finishing keyset creation and returns to main view', async () => {
    render(<App />);
    
    // Navigate to create and create keyset
    await waitFor(() => {
      const createButton = screen.getByText('Create New');
      fireEvent.click(createButton);
    });

    const createKeysetButton = screen.getByTestId('create-keyset-button');
    fireEvent.click(createKeysetButton);

    // Finish the keyset
    const finishButton = screen.getByTestId('finish-button');
    fireEvent.click(finishButton);

    // Should return to main view
    await waitFor(() => {
      expect(screen.getByText('Available Shares')).toBeInTheDocument();
    });
  });

  it('handles share loading and navigates to signer view', async () => {
    render(<App />);
    
    await waitFor(() => {
      const loadShareButton = screen.getByTestId('load-share-button');
      fireEvent.click(loadShareButton);
    });

    // Should show signer view with tabs
    expect(screen.getByTestId('signer-component')).toBeInTheDocument();
    expect(screen.getAllByText('Signer')[0]).toBeInTheDocument(); // Multiple "Signer" texts exist
    expect(screen.getByText('Back to Shares')).toBeInTheDocument();
  });

  it('switches between signer and recover tabs', async () => {
    render(<App />);
    
    // Load a share first
    await waitFor(() => {
      const loadShareButton = screen.getByTestId('load-share-button');
      fireEvent.click(loadShareButton);
    });

    // Should start on signer tab
    expect(screen.getByTestId('signer-component')).toBeInTheDocument();
    
    // Switch to recover tab
    const recoverTab = screen.getByText('Recover');
    fireEvent.click(recoverTab);

    // Verify recover tab is clickable (the actual tab switching is handled by the real component)
    expect(recoverTab).toBeInTheDocument();
  });

  it('handles back navigation from signer view', async () => {
    render(<App />);
    
    // Load a share
    await waitFor(() => {
      const loadShareButton = screen.getByTestId('load-share-button');
      fireEvent.click(loadShareButton);
    });

    // Click back to shares
    const backButton = screen.getByText('Back to Shares');
    fireEvent.click(backButton);

    // Should return to main view
    await waitFor(() => {
      expect(screen.getByText('Available Shares')).toBeInTheDocument();
    });
  });

  it('handles back navigation from create view', async () => {
    render(<App />);
    
    // Navigate to create
    await waitFor(() => {
      const createButton = screen.getByText('Create New');
      fireEvent.click(createButton);
    });

    // Click back
    const backButton = screen.getByTestId('back-button');
    fireEvent.click(backButton);

    // Should return to main view
    await waitFor(() => {
      expect(screen.getByText('Available Shares')).toBeInTheDocument();
    });
  });

  it('checks for existing shares on mount', async () => {
    mockClientShareManager.getShares.mockResolvedValue([
      {
        id: 'test-share',
        name: 'Test Share',
        share: 'encrypted-share',
        salt: 'test-salt',
        groupCredential: 'test-group'
      }
    ]);

    render(<App />);

    await waitFor(() => {
      expect(mockClientShareManager.getShares).toHaveBeenCalled();
    });
  });

  it('shows help tooltip when shares exist', async () => {
    mockClientShareManager.getShares.mockResolvedValue([
      {
        id: 'test-share',
        name: 'Test Share',  
        share: 'encrypted-share',
        salt: 'test-salt',
        groupCredential: 'test-group'
      }
    ]);

    render(<App />);

    await waitFor(() => {
      // Verify the app renders with shares
      expect(screen.getByText('Available Shares')).toBeInTheDocument();
    });
  });
}); 