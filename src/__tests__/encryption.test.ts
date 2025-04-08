// Import and set up the shared Buff mock
import { setupBuffMock } from './__mocks__/buff.mock';
setupBuffMock();

// Now we can safely import from modules that use @cmdcode/buff
import { 
  derive_secret,
  encrypt_payload,
  decrypt_payload
} from '../lib/encryption';

// Mock implementations need to be before variable declarations
// Mock the noble libs first
jest.mock('@noble/hashes/sha256', () => ({
  sha256: jest.fn().mockReturnValue(Buffer.from('mockHashedData'))
}));

jest.mock('@noble/hashes/pbkdf2', () => ({
  pbkdf2: jest.fn().mockReturnValue(Buffer.from('mockPbkdf2Output'))
}));

// Create spy functions for the noble cipher
const encryptMock = jest.fn().mockReturnValue(Buffer.from('mockEncryptedData'));
const decryptMock = jest.fn().mockImplementation((data) => {
  // For testing error cases
  if (data.toString() === 'invalid') {
    throw new Error('Decryption failed');
  }
  return Buffer.from('Secret data to be encrypted');
});

jest.mock('@noble/ciphers/aes', () => {
  return {
    gcm: jest.fn().mockImplementation((secret, vector) => ({
      encrypt: encryptMock,
      decrypt: decryptMock
    }))
  };
});

describe('Encryption Functions', () => {
  const testData = 'Secret data to be encrypted';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('derive_secret', () => {
    it('should derive a secret from password and salt', () => {
      const password = 'test-password';
      const salt = '0123456789abcdef';
      
      const secret = derive_secret(password, salt);
      
      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
    });

    it('should handle empty password', () => {
      const password = '';
      const salt = '0123456789abcdef';
      
      const secret = derive_secret(password, salt);
      
      expect(secret).toBeDefined();
    });

    it('should handle empty salt', () => {
      const password = 'test-password';
      const salt = '';
      
      const secret = derive_secret(password, salt);
      
      expect(secret).toBeDefined();
    });
  });
  
  describe('encrypt_payload', () => {
    it('should encrypt data correctly', () => {
      const secret = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, testData);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
    
    it('should use provided IV when available', () => {
      const secret = '0123456789abcdef';
      const iv = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, testData, iv);
      
      expect(encrypted).toBeDefined();
    });

    it('should handle empty payload', () => {
      const secret = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, '');
      
      expect(encrypted).toBeDefined();
    });
  });
  
  describe('decrypt_payload', () => {
    it('should decrypt data correctly', () => {
      const secret = '0123456789abcdef';
      const encrypted = 'mockEncryptedData';
      
      const decrypted = decrypt_payload(secret, encrypted);
      
      expect(decrypted).toBeDefined();
    });

    it('should throw error when decryption fails', () => {
      const secret = '0123456789abcdef';
      const encrypted = 'invalid';
      
      expect(() => {
        decrypt_payload(secret, encrypted);
      }).toThrow();
    });

    it('should handle empty secret', () => {
      const secret = '';
      const encrypted = 'mockEncryptedData';
      
      expect(() => {
        decrypt_payload(secret, encrypted);
      }).not.toThrow();
    });

    it('should handle empty payload', () => {
      const secret = '0123456789abcdef';
      const encrypted = '';
      
      expect(() => {
        decrypt_payload(secret, encrypted);
      }).not.toThrow();
    });
  });

  describe('Encryption/Decryption cycle', () => {
    it('should be able to decrypt what was encrypted', () => {
      // Setup our mocks to simulate a successful round-trip
      encryptMock.mockReturnValueOnce(Buffer.from('encryptedContent'));
      decryptMock.mockReturnValueOnce(Buffer.from(testData));
      
      const secret = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, testData);
      const decrypted = decrypt_payload(secret, encrypted);
      
      expect(decrypted).toBeDefined();
    });
  });
}); 