import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in test environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

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
  generateKeysetWithSecret: jest.fn(),
  validateShare: jest.fn(),
  validateGroup: jest.fn(),
  decodeShare: jest.fn(),
  decodeGroup: jest.fn(),
  validateRelay: jest.fn(),
  createConnectedNode: jest.fn(),
  recoverSecretKeyFromCredentials: jest.fn(),
  startListeningForAllEchoes: jest.fn(),
  cleanupBifrostNode: jest.fn(),
  isNodeReady: jest.fn(),
  generateNostrKeyPair: jest.fn(),
  nsecToHex: jest.fn(),
  validateNsec: jest.fn(),
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

// Test utilities for better test organization
export const createMockShare = (overrides = {}) => ({
  id: 'mock-share-id',
  name: 'Mock Share',
  share: 'mock-share-data',
  salt: 'mock-salt',
  groupCredential: 'mock-group-credential',
  savedAt: new Date().toISOString(),
  ...overrides
});

export const createMockKeyset = (overrides = {}) => ({
  groupCredential: 'mock-group-credential',
  shareCredentials: ['share1', 'share2', 'share3'],
  name: 'Mock Keyset',
  threshold: 2,
  ...overrides
});

export const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced mock implementations for better testing
export const mockValidationResults = {
  validPassword: {
    isValid: true,
    hasMinLength: true,
    hasUppercase: true,
    hasLowercase: true,
    hasNumbers: true,
    hasSpecialChars: true
  },
  invalidPassword: {
    isValid: false,
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumbers: false,
    hasSpecialChars: false
  },
  validSalt: {
    isValid: true,
    hasMinLength: true,
    isHexadecimal: true
  },
  invalidSalt: {
    isValid: false,
    hasMinLength: false,
    isHexadecimal: false,
    message: 'Salt is required'
  }
};

// Export for use in tests
export { mockIpcRenderer }; 