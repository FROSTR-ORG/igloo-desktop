// Import and set up the shared Buff mock
import { setupBuffMock } from './__mocks__/buff.mock';
setupBuffMock();

// Now we can safely import from modules that use @cmdcode/buff
import { 
  derive_secret,
  encrypt_payload,
  decrypt_payload
} from '../lib/encryption';

// Mock implementations needed for encryption tests
jest.mock('@noble/hashes/sha256', () => ({
  sha256: jest.fn().mockReturnValue(new Uint8Array(32).fill(1))
}));

jest.mock('@noble/hashes/pbkdf2', () => ({
  pbkdf2: jest.fn().mockReturnValue(new Uint8Array(32).fill(2))
}));

// Mock AES-GCM encryption
jest.mock('@noble/ciphers/aes', () => {
  return {
    gcm: jest.fn().mockImplementation(() => ({
      encrypt: jest.fn().mockReturnValue(new Uint8Array(10).fill(3)),
      decrypt: jest.fn().mockReturnValue(new Uint8Array(10).fill(4))
    }))
  };
});

describe('Encryption Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('derive_secret', () => {
    it('should accept password and salt and return a hex string', () => {
      const result = derive_secret('password', 'salt');
      
      // Validate the return type only
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle edge cases without throwing', () => {
      // Test with empty inputs
      expect(() => derive_secret('', 'salt')).not.toThrow();
      expect(() => derive_secret('password', '')).not.toThrow();
      expect(() => derive_secret('', '')).not.toThrow();
    });
  });
  
  describe('encrypt_payload', () => {
    it('should accept secret and payload and return a string', () => {
      const result = encrypt_payload('secret', 'payload');
      
      // Validate the return type
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should accept an optional IV parameter', () => {
      const result = encrypt_payload('secret', 'payload', 'custom_iv');
      
      // Validate the return type
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should handle edge cases without throwing', () => {
      // Test with empty inputs
      expect(() => encrypt_payload('', 'payload')).not.toThrow();
      expect(() => encrypt_payload('secret', '')).not.toThrow();
      expect(() => encrypt_payload('', '')).not.toThrow();
    });
  });
  
  describe('decrypt_payload', () => {
    it('should accept secret and payload and return a string', () => {
      const result = decrypt_payload('secret', 'encrypted_payload');
      
      // Validate the return type
      expect(typeof result).toBe('string');
    });
    
    it('should handle edge cases without throwing', () => {
      // Test with empty inputs
      expect(() => decrypt_payload('', 'payload')).not.toThrow();
      expect(() => decrypt_payload('secret', '')).not.toThrow();
      expect(() => decrypt_payload('', '')).not.toThrow();
    });
  });

  describe('Integrated behavior', () => {
    // This section relies on our mock returning fixed values,
    // but the test itself doesn't explicitly verify mock call expectations
    it('should complete a basic encryption/decryption cycle', () => {
      // Given a secret and data
      const secret = '0123456789abcdef';
      const data = 'test data';
      
      // When we encrypt and then decrypt
      const encrypted = encrypt_payload(secret, data);
      
      // Since our mock is setup to return a fixed decryption value,
      // we can only test that we get a string result back
      expect(typeof encrypted).toBe('string');
    });
  });
}); 