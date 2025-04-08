// Test file for the mocked Buff class
// Import and set up the shared Buff mock
import { setupBuffMock, MockBuff } from './__mocks__/buff.mock';
setupBuffMock();

// Now we can import our mocked version
import { Buff } from '@cmdcode/buff';

// This test file validates that our mock Buff implementation behaves
// similarly to the real Buff library for the functionality we use

describe('Buff Library Mock', () => {
  describe('Constructor', () => {
    it('should handle string input', () => {
      const buff = new Buff('hello');
      expect(buff).toBeInstanceOf(Uint8Array);
      expect(buff.length).toBe(5); // 'hello' has 5 bytes in UTF-8
      expect(buff.str).toBe('hello');
    });

    it('should handle Uint8Array input', () => {
      const original = new Uint8Array([104, 101, 108, 108, 111]); // 'hello' in ASCII
      const buff = new Buff(original);
      expect(buff).toBeInstanceOf(Uint8Array);
      expect(buff.length).toBe(5);
      expect(buff.str).toBe('hello');
    });

    it('should handle number input for size', () => {
      const buff = new Buff(10); // Create a 10-byte buffer
      expect(buff).toBeInstanceOf(Uint8Array);
      expect(buff.length).toBe(10);
    });
  });

  describe('Static Methods', () => {
    it('Buff.str should convert string to object with digest', () => {
      const result = Buff.str('test');
      expect(result).toHaveProperty('digest');
      expect(result.digest).toBeInstanceOf(Uint8Array);
    });

    it('Buff.hex should convert hex string to bytes', () => {
      const bytes = Buff.hex('68656c6c6f'); // 'hello' in hex
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(5);
      expect(Buffer.from(bytes).toString()).toBe('hello');
    });

    it('Buff.random should generate buffer of specified size', () => {
      const bytes = Buff.random(16);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
    });

    it('Buff.join should combine multiple buffers', () => {
      const buf1 = new Uint8Array([1, 2, 3]);
      const buf2 = new Uint8Array([4, 5, 6]);
      const result = Buff.join([buf1, buf2]);
      expect(result).toHaveProperty('b64url');
      expect(typeof result.b64url).toBe('string');
    });

    it('Buff.b64url should handle valid and invalid input', () => {
      // Valid input
      const result1 = Buff.b64url('aGVsbG8'); // "hello" in base64
      expect(result1).toHaveProperty('slice');
      expect(result1).toHaveProperty('toString');
      
      // Invalid input
      const result2 = Buff.b64url('invalid');
      expect(result2.toString()).toBe('invalid');
    });
  });

  describe('Instance Methods and Properties', () => {
    it('should convert to hex string', () => {
      const buff = new Buff('hello');
      expect(buff.hex).toBe('68656c6c6f'); // 'hello' in hex
    });

    it('should convert to string', () => {
      const buff = new Buff(Buffer.from('hello'));
      expect(buff.str).toBe('hello');
    });

    it('should handle slicing', () => {
      const buff = new Buff('hello world');
      const sliced = buff.slice(0, 5);
      expect(sliced).toBeInstanceOf(Uint8Array);
      expect(sliced.str).toBe('hello');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid data in str property', () => {
      // Create a buffer that exactly equals 'invalid'
      const buff = new Buff('invalid');
      expect(() => {
        // This should throw with our mock implementation
        const _ = buff.str;
      }).toThrow();
    });
  });

  describe('Encryption Compatibility', () => {
    it('should work with basic buffer operations', () => {
      // Testing buffer compatibility without encryption
      const buff1 = new Buff('test');
      const buff2 = new Buff(Buffer.from('data'));
      
      // Test basic operations
      expect(buff1.length).toBe(4);
      expect(buff2.length).toBe(4);
      expect(buff1.hex).toBe('74657374'); // 'test' in hex
      
      // Test static methods
      const hexBytes = Buff.hex('74657374');
      expect(Buffer.from(hexBytes).toString()).toBe('test');
    });
  });
}); 