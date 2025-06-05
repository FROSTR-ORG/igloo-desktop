import {
  nsecToHex,
  hexToNsec,
  generateNostrKeyPair,
  derivePublicKey,
  validateHexKey,
  validateNostrKey,
  hexToNpub,
  npubToHex
} from '@frostr/igloo-core'

// Re-export all nostr utilities from igloo/core
export {
  nsecToHex,
  hexToNsec,
  derivePublicKey,
  validateHexKey,
  validateNostrKey,
  hexToNpub,
  npubToHex
}

/**
 * Generates a new nostr secret key (nsec) and its corresponding public key (npub)
 * @returns Object containing both nsec and npub
 * 
 * @deprecated Use generateNostrKeyPair from @igloo/core instead
 */
export function generateNsec(): { nsec: string; npub: string } {
  const keyPair = generateNostrKeyPair()
  return {
    nsec: keyPair.nsec,
    npub: keyPair.npub
  }
}

// Export the full generateNostrKeyPair function as well
export { generateNostrKeyPair }
