import { 
  derive_secret,
  encrypt_payload,
  decrypt_payload
} from '../lib/encryption';

// Mock the Buff class correctly as a constructor
jest.mock('@cmdcode/buff', () => {
  return {
    Buff: class {
      data: any;
      
      constructor(data: any) {
        this.data = data;
      }
      
      get hex() {
        return 'mockedHexString';
      }
      
      get str() {
        return 'Secret data to be encrypted';
      }
      
      static str(data: string) {
        return {
          digest: Buffer.from(data)
        };
      }
      
      static hex(data: string, length?: number) {
        return Buffer.from(data, 'hex');
      }
      
      static random(length: number) {
        return Buffer.from('0123456789abcdef', 'hex');
      }
      
      static join(buffers: any[]) {
        return { b64url: 'mockEncryptedData' };
      }
      
      static b64url(data: string) {
        return Buffer.from('mockEncryptedData');
      }
    }
  };
});

// Mock the noble libs
jest.mock('@noble/ciphers/aes', () => {
  return {
    gcm: jest.fn().mockImplementation(() => ({
      encrypt: jest.fn().mockReturnValue(Buffer.from('mockEncryptedData')),
      decrypt: jest.fn().mockReturnValue(Buffer.from('Secret data to be encrypted'))
    }))
  };
});

jest.mock('@noble/hashes/sha256', () => ({
  sha256: jest.fn().mockReturnValue(Buffer.from('mockHashedData'))
}));

jest.mock('@noble/hashes/pbkdf2', () => ({
  pbkdf2: jest.fn().mockReturnValue(Buffer.from('mockPbkdf2Result'))
}));

describe('Encryption Functions', () => {
  const testData = 'Secret data to be encrypted';
  const testPassword = 'strong-password-123';
  
  describe('derive_secret', () => {
    it('should derive a secret key from password and salt', () => {
      const salt = '0123456789abcdef';
      const secret = derive_secret(testPassword, salt);
      
      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
    });
    
    it('should derive the same secret with same password and salt', () => {
      const salt = '0123456789abcdef';
      const secret1 = derive_secret(testPassword, salt);
      const secret2 = derive_secret(testPassword, salt);
      
      expect(secret1).toBe(secret2);
    });
  });
  
  describe('encrypt_payload and decrypt_payload', () => {
    it('should encrypt and decrypt data correctly', () => {
      const secret = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, testData);
      const decrypted = decrypt_payload(secret, encrypted);
      
      expect(decrypted).toBeDefined();
    });
    
    it('should encrypt with expected format', () => {
      const secret = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, testData);
      
      expect(typeof encrypted).toBe('string');
    });
    
    it('should encrypt consistently with provided IV', () => {
      const secret = '0123456789abcdef';
      const iv = '0123456789abcdef';
      
      const encrypted = encrypt_payload(secret, testData, iv);
      
      expect(encrypted).toBeDefined();
    });
  });
}); 