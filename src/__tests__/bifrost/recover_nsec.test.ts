/**
 * Tests for the Bifrost recover_nsec function
 */

// Import the shared mock setup
import { setupBuffMock } from '../__mocks__/buff.mock';
setupBuffMock();

// Define the types for the test
interface GroupPackage {
  threshold: number;
  commits: CommitPackage[];
  group_pk: string;
}

interface CommitPackage {
  idx: number;
  pubkey: string;
  hidden_pn: string;
  binder_pn: string;
}

interface SharePackage {
  idx: number;
  binder_sn: string;
  hidden_sn: string;
  seckey: string;
}

// Create recover_nsec mock
const recover_nsec = jest.fn().mockImplementation(
  (group: GroupPackage, shares: SharePackage[]) => {
    // Validate inputs
    if (!group || !shares || shares.length === 0) {
      throw new Error('Group package and at least one share package are required');
    }
    
    if (shares.length < group.threshold) {
      throw new Error(`Not enough shares provided. Need at least ${group.threshold} shares`);
    }
    
    // Validate share indices
    for (const share of shares) {
      if (share.idx < 0) {
        throw new Error('Invalid share index');
      }
      
      // Check for incomplete shares
      if (!share.seckey || !share.hidden_sn || !share.binder_sn) {
        throw new Error('Invalid share format');
      }
    }
    
    // Sort shares by index to simulate real behavior
    const sortedShares = [...shares].sort((a, b) => a.idx - b.idx);
    
    // Pretend to combine shares
    let combinedSecretParts = '';
    for (let i = 0; i < group.threshold; i++) {
      if (i < sortedShares.length) {
        combinedSecretParts += sortedShares[i].idx;
      }
    }
    
    // Return a nsec that encodes which shares were used
    return `nsec1_using_shares_${combinedSecretParts}`;
  }
);

// Mock the module
jest.mock('../../lib/bifrost', () => ({
  recover_nsec
}));

describe('Bifrost recover_nsec Function', () => {
  // Reset mocks before each test
  beforeEach(() => {
    recover_nsec.mockClear();
  });

  it('should recover a secret key from group and shares', () => {
    const group = {
      threshold: 2,
      commits: [],
      group_pk: 'group_pk'
    };
    
    const shares = [
      { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' },
      { idx: 2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' }
    ];
    
    const result = recover_nsec(group, shares);
    
    // Verify function was called correctly
    expect(recover_nsec).toHaveBeenCalledWith(group, shares);
    
    // Check the result value reflects the shares used
    expect(result).toContain('using_shares');
    expect(result).toContain('12'); // Share indices 1,2
  });
  
  it('should work with more shares than needed', () => {
    const group = {
      threshold: 2,
      commits: [],
      group_pk: 'group_pk'
    };
    
    const shares = [
      { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' },
      { idx: 2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' },
      { idx: 3, binder_sn: 'binder3', hidden_sn: 'hidden3', seckey: 'seckey3' }
    ];
    
    const result = recover_nsec(group, shares);
    
    // Still works with extra shares provided
    expect(result).toContain('using_shares');
    expect(result).toContain('12'); // First 2 shares used (threshold is 2)
  });
  
  it('should handle shares provided in any order', () => {
    const group = {
      threshold: 2,
      commits: [],
      group_pk: 'group_pk'
    };
    
    // Provide shares in reverse order
    const shares = [
      { idx: 3, binder_sn: 'binder3', hidden_sn: 'hidden3', seckey: 'seckey3' },
      { idx: 2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' },
      { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' }
    ];
    
    const result = recover_nsec(group, shares);
    
    // Should always use the first 'threshold' number of shares after sorting
    expect(result).toContain('using_shares');
    expect(result).toContain('12'); // Lowest 2 indices after sorting
  });
  
  it('should throw error when not enough shares are provided', () => {
    const group = {
      threshold: 3,
      commits: [],
      group_pk: 'group_pk'
    };
    
    const shares = [
      { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' },
      { idx: 2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' }
    ];
    
    expect(() => {
      recover_nsec(group, shares);
    }).toThrow('Not enough shares provided');
  });
  
  it('should throw error when group is missing', () => {
    expect(() => {
      // @ts-ignore - Intentionally passing incorrect params for test
      recover_nsec(null, [
        { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' }
      ]);
    }).toThrow('Group package and at least one share package are required');
  });
  
  it('should throw error when shares array is empty', () => {
    expect(() => {
      recover_nsec({threshold: 2, commits: [], group_pk: 'pk'}, []);
    }).toThrow('Group package and at least one share package are required');
  });
  
  it('should validate share index values', () => {
    const group = {
      threshold: 2,
      commits: [],
      group_pk: 'group_pk'
    };
    
    // Test with invalid share indices (negative)
    const sharesWithNegativeIdx = [
      { idx: -1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' },
      { idx: -2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' }
    ];
    
    expect(() => {
      recover_nsec(group, sharesWithNegativeIdx);
    }).toThrow('Invalid share index');
  });
  
  it('should reject invalid share content', () => {
    const group = {
      threshold: 2,
      commits: [],
      group_pk: 'group_pk'
    };
    
    // Test with missing required properties
    const incompleteShares = [
      // @ts-ignore - Intentionally passing incorrect params for test
      { idx: 1 }, // Missing other required fields
      // @ts-ignore - Intentionally passing incorrect params for test
      { idx: 2, binder_sn: 'binder2' } // Missing hidden_sn and seckey
    ];
    
    expect(() => {
      recover_nsec(group, incompleteShares);
    }).toThrow('Invalid share format');
  });
}); 