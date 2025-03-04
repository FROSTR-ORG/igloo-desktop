import { nip19 } from 'nostr-tools'

/**
 * Converts a nostr secret key (nsec) to its hex representation
 * @param nsec The nostr secret key in nsec format
 * @returns The secret key in hex format
 */
export function nsecToHex(nsec: string): string {
  try {
    const { type, data } = nip19.decode(nsec)
    if (type !== 'nsec') {
      throw new Error('Invalid nsec format')
    }
    // Convert Uint8Array to hex string
    return Buffer.from(data as Uint8Array).toString('hex')
  } catch (error) {
    throw new Error(`Failed to decode nsec: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Converts a hex secret key to nostr secret key (nsec) format
 * @param hex The secret key in hex format
 * @returns The secret key in nsec format
 */
export function hexToNsec(hex: string): string {
  try {
    // Convert hex string to Uint8Array
    const bytes = Buffer.from(hex, 'hex')
    return nip19.nsecEncode(bytes)
  } catch (error) {
    throw new Error(`Failed to encode nsec: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generates a new nostr secret key (nsec) and its corresponding public key (npub)
 * @returns Object containing both nsec and npub
 */
export function generateNsec(): { nsec: string; npub: string } {
  try {
    const { generateSecretKey, getPublicKey } = require('nostr-tools/pure')
    const sk = generateSecretKey()
    const pk = getPublicKey(sk)
    
    return {
      nsec: nip19.nsecEncode(sk),
      npub: nip19.npubEncode(pk)
    }
  } catch (error) {
    throw new Error(`Failed to generate keys: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
