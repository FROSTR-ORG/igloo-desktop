/**
 * Shared mock implementation for the @cmdcode/buff library
 * This mock extends Uint8Array to simulate the behavior of the Buff class
 */

// Jest will try to treat this file as a test, but it's not a test file
/* istanbul ignore file */
/* eslint-disable */
// @ts-nocheck

// Create a class that extends Uint8Array to better simulate the real Buff behavior
export class MockBuff extends Uint8Array {
  constructor(data: any, size?: number) {
    if (typeof data === 'string') {
      // Handle string input (simulate UTF-8 encoding)
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      super(bytes);
    } else if (data instanceof Uint8Array) {
      // Handle Uint8Array or Buffer input
      super(data);
    } else if (typeof data === 'number') {
      // Handle number input (create array of specified size)
      super(size || data);
    } else if (Array.isArray(data)) {
      // Handle array input
      super(data);
    } else {
      // Default fallback
      super(0);
    }
  }

  // Getter properties
  get hex() {
    return Buffer.from(this).toString('hex');
  }

  get str() {
    // For tests where we need to control the output
    if (this.length === 0) return '';
    // Check for the exact string 'invalid' rather than includes
    const content = Buffer.from(this).toString();
    if (content === 'invalid') {
      throw new Error('Invalid data');
    }
    return content;
  }

  get b64url() {
    return Buffer.from(this).toString('base64url');
  }

  // Instance methods
  slice(start?: number, end?: number) {
    const sliced = super.slice(start, end);
    return new MockBuff(sliced);
  }

  // Static methods
  static str(data: string) {
    return {
      digest: Buffer.from(data)
    };
  }

  static hex(data: string, size?: number) {
    try {
      const buffer = Buffer.from(data, 'hex');
      if (size && buffer.length < size) {
        // Create a new buffer of the requested size
        const padded = Buffer.alloc(size, 0);
        // Copy original data to the end of the buffer (right-aligned, zero-padded on the left)
        buffer.copy(padded, size - buffer.length);
        return padded;
      }
      return buffer;
    } catch (e) {
      return Buffer.alloc(size || 0);
    }
  }

  static random(length: number) {
    return Buffer.alloc(length, '0123456789abcdef');
  }

  static join(buffers: Uint8Array[]) {
    // Simulate joining buffers and returning base64url
    let totalLength = 0;
    buffers.forEach(buf => {
      totalLength += buf.length;
    });
    
    const result = Buffer.alloc(totalLength);
    let offset = 0;
    
    buffers.forEach(buf => {
      if (buf instanceof Uint8Array) {
        // Use set method which is standard for Uint8Array instead of copy
        result.set(new Uint8Array(buf), offset);
        offset += buf.length;
      }
    });
    
    return { b64url: result.toString('base64url') || 'mockJoinedData' };
  }

  static b64url(data: string) {
    // Create a more realistic implementation
    try {
      // Handle 'invalid' test case
      if (data === 'invalid') {
        return {
          slice: (start?: number, end?: number) => ({
            slice: () => new MockBuff('invalid'),
            toString: () => 'invalid'
          }),
          toString: () => 'invalid'
        };
      }
      
      // For normal cases, decode base64 data
      const buffer = Buffer.from(data, 'base64url');
      
      return {
        slice: (start?: number, end?: number) => {
          const sliced = buffer.slice(start, end);
          return sliced;
        },
        toString: () => buffer.toString()
      };
    } catch (e) {
      return {
        slice: () => Buffer.alloc(0),
        toString: () => ''
      };
    }
  }
}

/**
 * This function sets up the mock for the @cmdcode/buff library
 * Call this function in your test file before importing Buff
 */
export function setupBuffMock() {
  jest.mock('@cmdcode/buff', () => ({
    Buff: MockBuff
  }));
} 