// Test file for the mocked Buff class
// Import and set up the shared Buff mock
import { setupBuffMock } from './__mocks__/buff.mock';
setupBuffMock();

// Now we can import our mocked version
import { Buff } from '@cmdcode/buff';

// This test file validates that our mock Buff implementation properly supports
// the functionality needed by our application

describe('Buff Library Mock', () => {
  describe('Core functionality', () => {
    it('should handle basic data conversions', () => {
      // Test string handling and conversion to hex
      const buff = new Buff('hello');
      expect(buff.hex).toBe('68656c6c6f'); // 'hello' in hex
      expect(buff.str).toBe('hello');
      
      // Test hex string to buffer conversion
      const hexBuff = Buff.hex('68656c6c6f'); // 'hello' in hex
      expect(Buffer.from(hexBuff).toString()).toBe('hello');
    });

    it('should support buffer operations needed by our app', () => {
      // Test slicing - needed for decrypt_payload
      const buff = new Buff('test data');
      const sliced = buff.slice(0, 4);
      expect(sliced.str).toBe('test');
      
      // Test join - needed for encrypt_payload
      const buff1 = new Uint8Array([1, 2, 3]);
      const buff2 = new Uint8Array([4, 5, 6]);
      const result = Buff.join([buff1, buff2]);
      expect(result).toHaveProperty('b64url');
      
      // Test random - needed for IV generation
      const random = Buff.random(16);
      expect(random.length).toBe(16);
    });
  });

  describe('Error handling', () => {
    it('should properly handle error cases', () => {
      // Test invalid data handling
      expect(() => {
        const buff = new Buff('invalid');
        const _ = buff.str;
      }).toThrow();
      
      // Test base64url decoding with invalid data
      const result = Buff.b64url('invalid');
      expect(result.toString()).toBe('invalid');
    });
  });
}); 