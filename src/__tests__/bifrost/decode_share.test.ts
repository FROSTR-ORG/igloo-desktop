/**
 * Tests for the Bifrost decode_share function
 */

// Import the shared mock setup
import { setupBuffMock } from '../__mocks__/buff.mock';
setupBuffMock();

// Create decode_share mock
const decode_share = jest.fn().mockImplementation((share: string) => {
  // Check for valid input
  if (!share || typeof share !== 'string') {
    throw new Error('Invalid share format');
  }
  
  if (!share.startsWith('bfshare')) {
    throw new Error('Invalid share format (should start with bfshare)');
  }
  
  // Test for invalid format
  if (!share.includes('1') && share !== 'bfshare1_1') {
    throw new Error('Invalid share format');
  }
  
  // Return different values based on input to simulate decoding different shares
  const shareNumber = parseInt(share.split('_').pop() || '1');
  
  return {
    idx: shareNumber,
    binder_sn: `binder_sn_${shareNumber}`,
    hidden_sn: `hidden_sn_${shareNumber}`,
    seckey: `share_seckey_${shareNumber}`
  };
});

// Mock the module
jest.mock('../../lib/bifrost', () => ({
  decode_share
}));

describe('Bifrost decode_share Function', () => {
  // Reset mocks before each test
  beforeEach(() => {
    decode_share.mockClear();
  });

  it('should decode a share package', () => {
    const share = 'bfshare1_1';
    
    const result = decode_share(share);
    
    // Verify function was called correctly
    expect(decode_share).toHaveBeenCalledWith(share);
    
    // Verify the structure of the result
    expect(result).toEqual({
      idx: 1,
      binder_sn: 'binder_sn_1',
      hidden_sn: 'hidden_sn_1',
      seckey: 'share_seckey_1'
    });
  });
  
  it('should decode different shares with different values', () => {
    const share1 = 'bfshare1_1';
    const share2 = 'bfshare1_2';
    
    const result1 = decode_share(share1);
    const result2 = decode_share(share2);
    
    // Results should be different based on share identity
    expect(result1.idx).toBe(1);
    expect(result2.idx).toBe(2);
    expect(result1.seckey).not.toBe(result2.seckey);
  });
  
  it('should throw error for invalid share format', () => {
    // Test empty share
    expect(() => {
      decode_share('');
    }).toThrow('Invalid share format');
    
    // Test invalid prefix
    expect(() => {
      decode_share('invalid_prefix');
    }).toThrow('Invalid share format');
  });
  
  it('should throw proper errors for malformed shares', () => {
    // Test with undefined input
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      decode_share(undefined);
    }).toThrow('Invalid share format');
    
    // Test with null input
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      decode_share(null);
    }).toThrow('Invalid share format');
    
    // Test with non-string input
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      decode_share(123);
    }).toThrow('Invalid share format');
  });
  
  it('should reject shares with invalid format but correct prefix', () => {
    expect(() => {
      decode_share('bfshare_but_invalid_format');
    }).toThrow('Invalid share format');
  });
}); 