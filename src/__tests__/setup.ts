import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in test environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

// Provide a mock for the ESM-only @cmdcode/buff package used in encryption helpers
import { setupBuffMock } from './__mocks__/buff.mock';
setupBuffMock();

// Mock Electron globally for all tests
global.window = Object.create(window);
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
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
jest.mock('@frostr/igloo-core', () => {
  const normalizePubkey = jest.fn((value?: string) => {
    if (typeof value !== 'string') {
      return value;
    }

    if ((value.startsWith('02') || value.startsWith('03')) && value.length === 66) {
      return value.slice(2);
    }

    return value;
  });

  const comparePubkeys = jest.fn((a?: string, b?: string) => normalizePubkey(a) === normalizePubkey(b));

  return {
    generateKeysetWithSecret: jest.fn(),
    validateShare: jest.fn(),
    validateGroup: jest.fn(),
    decodeShare: jest.fn(),
    decodeGroup: jest.fn(),
    validateRelay: jest.fn(),
    createConnectedNode: jest.fn(),
    createPeerManagerRobust: jest.fn(async () => ({
      cleanup: jest.fn(),
    })),
    recoverSecretKeyFromCredentials: jest.fn(),
    startListeningForAllEchoes: jest.fn(),
    sendEcho: jest.fn().mockResolvedValue(true),
    DEFAULT_ECHO_RELAYS: ['wss://relay.damus.io', 'wss://relay.primal.net'],
    cleanupBifrostNode: jest.fn(),
    isNodeReady: jest.fn(),
    generateNostrKeyPair: jest.fn(),
    nsecToHex: jest.fn(),
    validateNsec: jest.fn(),
    normalizePubkey,
    comparePubkeys,
    extractSelfPubkeyFromCredentials: jest.fn(() => ({
      pubkey: 'mock-pubkey',
      warnings: [],
    })),
  };
});

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
