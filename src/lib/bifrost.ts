import { 
  encode_group_pkg,
  encode_share_pkg, 
  generate_dealer_pkg 
} from '@frostr/bifrost/lib'

/**
 * Generates a keyset with a random secret
 * @param threshold Number of shares required to sign
 * @param totalMembers Total number of shares to create
 * @returns Object containing encoded group and share credentials
 */
export function generateRandomKeyset(threshold: number, totalMembers: number) {
  validateKeysetParams(threshold, totalMembers);
  try {
    const secretKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    
    if (!secretKey) {
      throw new Error('Failed to generate secure random key');
    }

    const { group, shares } = generate_dealer_pkg(
      threshold,
      totalMembers,
      [secretKey]
    );

    return {
      groupCredential: encode_group_pkg(group),
      shareCredentials: shares.map(encode_share_pkg)
    };
  } catch (error: any) {
    throw new Error(`Failed to generate keyset: ${error.message}`);
  }
}

/**
 * Generates a keyset with a provided secret
 * @param threshold Number of shares required to sign
 * @param totalMembers Total number of shares to create
 * @param secretKey Hex-encoded secret key
 * @returns Object containing encoded group and share credentials
 */
export function generateKeysetWithSecret(threshold: number, totalMembers: number, secretKey: string) {
  validateKeysetParams(threshold, totalMembers);
  if (!secretKey || typeof secretKey !== 'string') {
    throw new Error('Secret key must be a non-empty string');
  }
  // Generate the threshold signing group using provided secret
  const { group, shares } = generate_dealer_pkg(
    threshold,
    totalMembers,
    [secretKey]
  )

  // Encode the group and shares as bech32 strings
  return {
    groupCredential: encode_group_pkg(group),
    shareCredentials: shares.map(encode_share_pkg)
  }
}

function validateKeysetParams(threshold: number, totalMembers: number) {
  if (threshold <= 0 || totalMembers <= 0) {
    throw new Error('Threshold and total members must be positive numbers');
  }
  if (threshold > totalMembers) {
    throw new Error('Threshold cannot be greater than total members');
  }
}
