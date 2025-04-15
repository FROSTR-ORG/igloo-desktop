/**
 * Mock implementation for the Bifrost library
 * This file provides mock functions that can be used across different test files.
 */

// Jest will try to treat this file as a test, but it's not a test file
/* istanbul ignore file */
/* eslint-disable */

// Basic mock implementations for common Bifrost functions
export const encode_group_pkg = jest.fn().mockReturnValue('mocked_group_pkg');
export const decode_group_pkg = jest.fn().mockReturnValue({
  threshold: 2,
  commits: [
    { idx: 1, pubkey: 'pubkey1', hidden_pn: 'hidden1', binder_pn: 'binder1' },
    { idx: 2, pubkey: 'pubkey2', hidden_pn: 'hidden2', binder_pn: 'binder2' },
    { idx: 3, pubkey: 'pubkey3', hidden_pn: 'hidden3', binder_pn: 'binder3' }
  ],
  group_pk: 'group_pubkey'
});

export const encode_share_pkg = jest.fn().mockReturnValue('mocked_share_pkg');
export const decode_share_pkg = jest.fn().mockReturnValue({
  idx: 1,
  binder_sn: 'binder_sn',
  hidden_sn: 'hidden_sn',
  seckey: 'share_seckey'
});

export const generate_dealer_pkg = jest.fn().mockReturnValue({
  group: { 
    threshold: 2, 
    commits: [
      { idx: 1, pubkey: 'pubkey1', hidden_pn: 'hidden1', binder_pn: 'binder1' },
      { idx: 2, pubkey: 'pubkey2', hidden_pn: 'hidden2', binder_pn: 'binder2' },
      { idx: 3, pubkey: 'pubkey3', hidden_pn: 'hidden3', binder_pn: 'binder3' }
    ], 
    group_pk: 'group_pk' 
  },
  shares: [
    { idx: 1, binder_sn: 'binder1', hidden_sn: 'hidden1', seckey: 'seckey1' },
    { idx: 2, binder_sn: 'binder2', hidden_sn: 'hidden2', seckey: 'seckey2' },
    { idx: 3, binder_sn: 'binder3', hidden_sn: 'hidden3', seckey: 'seckey3' }
  ]
});

export const recover_secret_key = jest.fn().mockReturnValue('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

// Export mockFunctions object for backward compatibility with shared-bifrost-mocks.ts
export const mockFunctions = {
  encode_group_pkg,
  decode_group_pkg,
  encode_share_pkg,
  decode_share_pkg,
  generate_dealer_pkg,
  recover_secret_key
};

// Mock classes
export class BifrostNode {
  constructor() {
    // Properties defined as class properties
  }

  on = jest.fn();
  emit = jest.fn();
  connect = jest.fn().mockResolvedValue(this);
  close = jest.fn().mockResolvedValue(this);
}

export class BifrostSigner {
  constructor() {
    // Properties defined as class properties
  }

  pubkey = 'mocked_pubkey';
  sign = jest.fn().mockResolvedValue('mocked_signature');
}

/**
 * This function sets up the mock for the Bifrost library
 * Call this function in your test file before importing Bifrost
 * 
 * @param path The relative path to the Bifrost library module
 * @example
 * // In a test file in src/__tests__
 * import { setupBifrostMock } from './__mocks__/bifrost.mock';
 * setupBifrostMock('../lib/bifrost');
 * 
 * @example
 * // In a test file in src/__tests__/bifrost
 * import { setupBifrostMock } from '../__mocks__/bifrost.mock';
 * setupBifrostMock('../../lib/bifrost');
 */
export function setupBifrostMock(path = '../lib/bifrost') {
  jest.mock(path, () => ({
    encode_group_pkg,
    decode_group_pkg,
    encode_share_pkg,
    decode_share_pkg,
    generate_dealer_pkg,
    recover_secret_key,
    BifrostNode,
    BifrostSigner
  }));
}

/**
 * Creates a mock implementation for the generateKeysetWithSecret function
 * with customizable behavior.
 */
export function createGenerateKeysetWithSecretMock() {
  return jest.fn().mockImplementation(
    (threshold: number, totalMembers: number, secretKey: string) => {
      // Validate input
      if (threshold <= 0 || totalMembers <= 0) {
        throw new Error('Threshold and total members must be positive numbers');
      }
      if (threshold > totalMembers) {
        throw new Error('Threshold cannot be greater than total members');
      }
      if (!secretKey || typeof secretKey !== 'string') {
        throw new Error('Secret key must be a non-empty string');
      }
      
      // Add constraint for unreasonably large values
      if (threshold > 100 || totalMembers > 100) {
        throw new Error('Threshold and member count must be reasonable');
      }
      
      // For nsec format, simulate decoding
      let processedKey = secretKey;
      if (secretKey.startsWith('nsec')) {
        // Use a hash of the input key to simulate different outputs for different keys
        processedKey = secretKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString();
      }
      
      // Return a realistic result structure with outputs dependent on the inputs
      const shareCredentials = Array(totalMembers).fill(0).map((_, i) => 
        `mocked_share_pkg_${processedKey.substring(0, 8)}_${i+1}`
      );
      
      return {
        groupCredential: `mocked_group_pkg_${processedKey.substring(0, 8)}_${threshold}_of_${totalMembers}`,
        shareCredentials
      };
    }
  );
}

/**
 * Creates a mock implementation for the decode_share function
 * with customizable behavior.
 */
export function createDecodeShareMock() {
  return jest.fn().mockImplementation((share: string) => {
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
}

/**
 * Creates a mock implementation for the decode_group function
 * with customizable behavior.
 */
export function createDecodeGroupMock() {
  return jest.fn().mockImplementation((group: string) => {
    // Check for valid input
    if (!group || typeof group !== 'string') {
      throw new Error('Invalid group format');
    }
    
    if (!group.startsWith('bfgroup')) {
      throw new Error('Invalid group format (should start with bfgroup)');
    }
    
    // Parse the threshold and total from the mock format
    const parts = group.split('_');
    
    // Look for threshold in the format pattern
    let threshold = 2; // Default value
    let totalMembers = 3; // Default value
    
    if (group.includes('3_of_5')) {
      threshold = 3;
      totalMembers = 5;
    } else if (group.includes('2_of_3')) {
      threshold = 2;
      totalMembers = 3;
    } else if (group.includes('0_of_0') || (parts.length >= 6 && (parseInt(parts[3]) === 0 || parseInt(parts[5]) === 0))) {
      // Detect invalid thresholds or member counts of zero
      throw new Error('Invalid group format');
    } else if (parts.length >= 4 && !isNaN(parseInt(parts[3]))) {
      // Try to extract from pattern like 'bfgroup_3_of_5'
      threshold = parseInt(parts[3]);
      if (parts.length >= 6 && !isNaN(parseInt(parts[5]))) {
        totalMembers = parseInt(parts[5]);
      }
    }
    
    // Generate commits based on the total
    const commits = Array(totalMembers).fill(0).map((_, i) => ({
      idx: i + 1,
      pubkey: `pubkey${i + 1}`,
      hidden_pn: `hidden${i + 1}`,
      binder_pn: `binder${i + 1}`
    }));
    
    return {
      threshold,
      commits,
      group_pk: 'group_pubkey'
    };
  });
}

/**
 * Creates a mock implementation for the recover_nsec function
 * with customizable behavior.
 */
export function createRecoverNsecMock() {
  return jest.fn().mockImplementation(
    (group: any, shares: any[]) => {
      // Validate inputs
      if (!group || !shares || shares.length === 0) {
        throw new Error('Group package and at least one share package are required');
      }
      
      if (shares.length < group.threshold) {
        throw new Error(`Not enough shares provided. Need at least ${group.threshold} shares`);
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
} 