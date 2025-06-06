import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in test environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock Electron globally for all tests
global.window = Object.create(window);
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer,
  },
  writable: true,
});

// Mock modules that cause issues in test environment
jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer,
  app: {
    getPath: jest.fn().mockReturnValue('/mock/app/data'),
  },
}));

// Mock igloo-core module
jest.mock('@frostr/igloo-core', () => ({
  generateKeyset: jest.fn(),
  validateShare: jest.fn(),
  validateGroupCredential: jest.fn(),
  decodeShare: jest.fn(),
  validateRelayUrl: jest.fn(),
  createSigningNode: jest.fn(),
  recoverNsec: jest.fn(),
}));

// Suppress console logs during tests unless needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Optionally suppress console output during tests
  if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console if it was mocked
  if (console.log !== originalConsoleLog) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
});

// Global test utilities
export const mockClientShareManager = {
  getShares: jest.fn(),
  saveShare: jest.fn(),
  deleteShare: jest.fn(),
  openShareLocation: jest.fn(),
  findSharesByBinderSN: jest.fn(),
};

export const mockDeriveSecret = jest.fn();

// Export for use in tests
export { mockIpcRenderer }; 