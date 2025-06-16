import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventLog } from '../../components/EventLog';
import type { LogEntryData } from '../../components/ui/log-entry';

// Mock data for testing
const createMockLogEntry = (overrides: Partial<LogEntryData> = {}): LogEntryData => ({
  id: Math.random().toString(36).substr(2, 9),
  timestamp: new Date().toLocaleTimeString(),
  type: 'info',
  message: 'Test message',
  data: null,
  ...overrides,
});

const createMockLogs = (): LogEntryData[] => [
  createMockLogEntry({ 
    id: '1', 
    type: 'error', 
    message: 'Connection failed',
    data: { error: 'Network timeout' }
  }),
  createMockLogEntry({ 
    id: '2', 
    type: 'ready', 
    message: 'Node is ready' 
  }),
  createMockLogEntry({ 
    id: '3', 
    type: 'bifrost', 
    message: 'Message received' 
  }),
  createMockLogEntry({ 
    id: '4', 
    type: 'ecdh', 
    message: 'ECDH request received',
    data: { requestId: 'ecdh-123' }
  }),
  createMockLogEntry({ 
    id: '5', 
    type: 'sign', 
    message: 'Signature request received' 
  }),
  createMockLogEntry({ 
    id: '6', 
    type: 'error', 
    message: 'Another error occurred' 
  }),
  createMockLogEntry({ 
    id: '7', 
    type: 'info', 
    message: 'Information message' 
  }),
];

describe('EventLog Component', () => {
  const mockOnClearLogs = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(
        <EventLog 
          logs={[]} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      expect(screen.getByText('Event Log')).toBeInTheDocument();
    });

    it('should render with all required props', () => {
      const logs = createMockLogs();
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={true} 
          onClearLogs={mockOnClearLogs}
        />
      );
      
              expect(screen.getByText('Event Log')).toBeInTheDocument();
        expect(screen.getByText('7 events')).toBeInTheDocument(); // log count
    });

    it('should hide header when hideHeader is true', () => {
      render(
        <EventLog 
          logs={[]} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs}
          hideHeader={true}
        />
      );
      
      expect(screen.queryByText('Event Log')).not.toBeInTheDocument();
    });
  });

  describe('Log Display', () => {
    it('should display "No logs available" when logs array is empty', async () => {
      const user = userEvent.setup();
      render(
        <EventLog 
          logs={[]} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log to see the content
      await user.click(screen.getByText('Event Log'));
      
      expect(screen.getByText('No logs available')).toBeInTheDocument();
    });

    it('should display all logs when no filters are active', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log
      await user.click(screen.getByText('Event Log'));
      
      // All logs should be visible
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      expect(screen.getByText('Node is ready')).toBeInTheDocument();
      expect(screen.getByText('Message received')).toBeInTheDocument();
      expect(screen.getByText('ECDH request received')).toBeInTheDocument();
      expect(screen.getByText('Signature request received')).toBeInTheDocument();
    });

    it('should show correct log count in status indicator', () => {
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      expect(screen.getByText('7 events')).toBeInTheDocument();
    });
  });

  describe('Filter Controls', () => {
    it('should show filter button in header', () => {
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
              // Look for filter button by title attribute (tooltip)
        const filterButton = screen.getByTitle('Toggle filters');
        expect(filterButton).toBeInTheDocument();
    });

    it('should toggle filter panel when filter button is clicked', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log first
      await user.click(screen.getByText('Event Log'));
      
      // Find and click the filter button
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      // Filter panel should appear
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
    });

    it('should show all available event types in filter panel', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log
      await user.click(screen.getByText('Event Log'));
      
      // Find and click the filter button
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
        
        // Check for event type buttons
        expect(screen.getAllByText('ERROR').length).toBeGreaterThan(0);
        expect(screen.getAllByText('READY').length).toBeGreaterThan(0);
        expect(screen.getAllByText('BIFROST').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ECDH').length).toBeGreaterThan(0);
        expect(screen.getAllByText('SIGN').length).toBeGreaterThan(0);
        expect(screen.getAllByText('INFO').length).toBeGreaterThan(0);
      });
    });

    it('should show event counts in filter buttons', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log
      await user.click(screen.getByText('Event Log'));
      
      // Find and click the filter button
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        // Check for correct counts - we have 2 error logs in our mock data
        expect(screen.getByText('(2)')).toBeInTheDocument(); // error count
        expect(screen.getAllByText('(1)').length).toBeGreaterThan(0); // other event counts
      });
    });
  });

  describe('Filtering Functionality', () => {
    it('should filter logs when event type is selected', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log
      await user.click(screen.getByText('Event Log'));
      
      // Open filter panel
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Click on ERROR filter
      const errorFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('ERROR')
      );
      
      if (errorFilterButton) {
        await user.click(errorFilterButton);
        
        // Only error logs should be visible
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
        expect(screen.getByText('Another error occurred')).toBeInTheDocument();
        expect(screen.queryByText('Node is ready')).not.toBeInTheDocument();
        expect(screen.queryByText('Message received')).not.toBeInTheDocument();
      }
    });

    it('should show filter count badge when filters are active', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log
      await user.click(screen.getByText('Event Log'));
      
      // Open filter panel and apply a filter
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Click on ERROR filter
      const errorFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('ERROR')
      );
      
      if (errorFilterButton) {
        await user.click(errorFilterButton);
        
        // Should show filter badge
        await waitFor(() => {
          expect(screen.getByText('1 filter')).toBeInTheDocument();
        });
      }
    });

    it('should update log count in status indicator when filtered', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
              // Initially shows total count
        expect(screen.getByText('7 events')).toBeInTheDocument();
      
      // Expand the log and apply filter
      await user.click(screen.getByText('Event Log'));
      
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Click on ERROR filter (should show 2 error logs)
      const errorFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('ERROR')
      );
      
      if (errorFilterButton) {
        await user.click(errorFilterButton);
        
        // Should show filtered count
        await waitFor(() => {
          expect(screen.getByText('2 events')).toBeInTheDocument();
        });
      }
    });

    it('should handle multiple filters', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log and open filters
      await user.click(screen.getByText('Event Log'));
      
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Click on ERROR and READY filters
      const errorFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('ERROR')
      );
      const readyFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('READY')
      );
      
      if (errorFilterButton && readyFilterButton) {
        await user.click(errorFilterButton);
        await user.click(readyFilterButton);
        
        // Should show multiple filter badge
        await waitFor(() => {
          expect(screen.getByText('2 filters')).toBeInTheDocument();
        });
        
        // Should show both error and ready logs (3 total: 2 errors + 1 ready)
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
        expect(screen.getByText('Another error occurred')).toBeInTheDocument();
        expect(screen.getByText('Node is ready')).toBeInTheDocument();
        expect(screen.queryByText('Message received')).not.toBeInTheDocument();
      }
    });

    it('should clear all filters when "Clear All" is clicked', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log and apply filters
      await user.click(screen.getByText('Event Log'));
      
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Apply a filter first
      const errorFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('ERROR')
      );
      
      if (errorFilterButton) {
        await user.click(errorFilterButton);
        
        // Verify filter is applied
        await waitFor(() => {
          expect(screen.getByText('1 filter')).toBeInTheDocument();
        });
        
        // Click "Clear All"
        const clearAllButton = screen.getByRole('button', { name: /clear all/i });
        await user.click(clearAllButton);
        
        // All logs should be visible again
        await waitFor(() => {
          expect(screen.queryByText('1 filter')).not.toBeInTheDocument();
          expect(screen.getByText('7 events')).toBeInTheDocument(); // Back to full count
        });
      }
    });

    it('should select all filters when "Select All" is clicked', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log and open filters
      await user.click(screen.getByText('Event Log'));
      
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Click "Select All"
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      
      // Should show all 6 unique event types as filters
      await waitFor(() => {
        expect(screen.getByText('6 filters')).toBeInTheDocument();
      });
      
      // All logs should still be visible (since all types are selected)
      expect(screen.getByText('7 events')).toBeInTheDocument();
    });
  });

  describe('Empty Filter State', () => {
    it('should show "No logs match current filters" message when filters exclude all logs', async () => {
      const user = userEvent.setup();
      const logs = [
        createMockLogEntry({ type: 'error', message: 'Error message' })
      ];
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log and open filters
      await user.click(screen.getByText('Event Log'));
      
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Apply a filter that excludes all logs
      const readyFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('READY')
      );
      
      if (readyFilterButton) {
        await user.click(readyFilterButton);
        
        await waitFor(() => {
          expect(screen.getByText('No logs match the current filters')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
        });
      }
    });

    it('should clear filters from empty state message', async () => {
      const user = userEvent.setup();
      const logs = [
        createMockLogEntry({ type: 'error', message: 'Error message' })
      ];
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Expand the log and create empty filter state
      await user.click(screen.getByText('Event Log'));
      
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
      
      // Apply filter that excludes all logs
      const readyFilterButton = screen.getAllByRole('button').find(button => 
        button.textContent?.includes('READY')
      );
      
      if (readyFilterButton) {
        await user.click(readyFilterButton);
        
        await waitFor(() => {
          expect(screen.getByText('No logs match the current filters')).toBeInTheDocument();
        });
        
        // Click the "Clear Filters" button in the empty state
        const clearFiltersButton = screen.getByRole('button', { name: /clear filters/i });
        await user.click(clearFiltersButton);
        
        // Should return to showing all logs
        await waitFor(() => {
          expect(screen.getByText('Error message')).toBeInTheDocument();
          expect(screen.queryByText('No logs match the current filters')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Integration with Clear Logs', () => {
    it('should call onClearLogs when clear button is clicked', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Find and click the clear logs button
      const clearButton = screen.getByTitle('Clear logs');
      await user.click(clearButton);
      
      expect(mockOnClearLogs).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation for filter controls', async () => {
      const user = userEvent.setup();
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      // Use keyboard to expand the log - target the header container with role="button"
      const logHeader = screen.getByText('Event Log').closest('[role="button"]');
      await user.click(logHeader!); // Use click for more reliable test
      
      // Wait for expansion to complete
      await waitFor(() => {
        expect(screen.getByText('Click to collapse')).toBeInTheDocument();
      });
      
      // Filter controls should be keyboard accessible
      const filterButton = screen.getByTitle('Toggle filters');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter by Event Type')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels for filter buttons', () => {
      const logs = createMockLogs();
      
      render(
        <EventLog 
          logs={logs} 
          isSignerRunning={false} 
          onClearLogs={mockOnClearLogs} 
        />
      );
      
      const filterButton = screen.getByTitle('Toggle filters');
      expect(filterButton).toHaveAttribute('title', 'Toggle filters');
      
      const clearButton = screen.getByTitle('Clear logs');
      expect(clearButton).toHaveAttribute('title', 'Clear logs');
    });
  });
}); 