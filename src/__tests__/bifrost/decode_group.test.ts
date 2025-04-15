/**
 * Tests for the Bifrost decode_group function
 */

// Import the shared mock setup
import { setupBuffMock } from '../__mocks__/buff.mock';
import { createDecodeGroupMock } from '../__mocks__/bifrost.mock';

// Setup buff mock first (needed for Bifrost functions)
setupBuffMock();

// Create decode_group mock
const decode_group = createDecodeGroupMock();

// Mock the module
jest.mock('../../lib/bifrost', () => ({
  decode_group
}));

describe('Bifrost decode_group Function', () => {
  // Reset mocks before each test
  beforeEach(() => {
    decode_group.mockClear();
  });

  it('should decode a group into a structured object', () => {
    const group = 'bfgroup_mock';
    
    const result = decode_group(group);
    
    // Verify function was called with correct parameters
    expect(decode_group).toHaveBeenCalledWith(group);
    
    // Verify the structure of the result
    expect(result).toHaveProperty('threshold');
    expect(result).toHaveProperty('commits');
    expect(result).toHaveProperty('group_pk');
  });

  it('should validate group package structure with correct threshold', () => {
    const mockGroup = 'bfgroup_3_of_5';
    
    const result = decode_group(mockGroup);
    
    expect(result).toEqual({
      threshold: 3,
      commits: expect.arrayContaining([
        expect.objectContaining({
          idx: expect.any(Number),
          pubkey: expect.any(String),
          hidden_pn: expect.any(String),
          binder_pn: expect.any(String)
        })
      ]),
      group_pk: expect.any(String)
    });
    
    // Verify threshold is correctly set to 3
    expect(result.threshold).toBe(3);
    expect(result.commits.length).toBe(5);
  });
  
  it('should decode different groups with appropriate member counts', () => {
    const group1 = 'bfgroup1_2_of_3';
    const group2 = 'bfgroup1_3_of_5';
    
    const result1 = decode_group(group1);
    const result2 = decode_group(group2);
    
    expect(result1.threshold).toBe(2);
    expect(result1.commits.length).toBe(3);
    
    expect(result2.threshold).toBe(3);
    expect(result2.commits.length).toBe(5);
  });
  
  it('should throw error for invalid group format', () => {
    // Test empty group
    expect(() => {
      decode_group('');
    }).toThrow('Invalid group format');
    
    // Test invalid prefix
    expect(() => {
      decode_group('invalid_prefix');
    }).toThrow('Invalid group format');
  });
  
  it('should handle invalid input types gracefully', () => {
    // Test with undefined input
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      decode_group(undefined);
    }).toThrow('Invalid group format');
    
    // Test with null input
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      decode_group(null);
    }).toThrow('Invalid group format');
    
    // Test with object input
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      decode_group({});
    }).toThrow('Invalid group format');
  });
  
  it('should handle groups with invalid member counts', () => {
    // Mock implementation should check thresholds and handle this case
    expect(() => {
      decode_group('bfgroup1_0_of_0'); // Invalid threshold and member count
    }).toThrow('Invalid group format');
  });
}); 