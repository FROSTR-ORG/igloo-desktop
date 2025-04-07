import { 
  encode_group_pkg,
  decode_group_pkg,
  encode_share_pkg, 
  decode_share_pkg,
  generate_dealer_pkg,
  recover_secret_key
} from '@frostr/bifrost/lib'
import { BifrostNode, SignatureEntry } from '@frostr/bifrost'
import type {
  GroupPackage,
  SharePackage
} from '@frostr/bifrost'
import { nip19 } from 'nostr-tools'

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
  // check if nsec
  if (secretKey.startsWith('nsec')) {
    secretKey = nip19.decode(secretKey).data as string
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

export function get_node ({ group, share, relays }: { group: string, share: string, relays: string[] }) {
  if (!relays || relays.length === 0) {
    throw new Error('At least one relay URL must be provided')
  }

  const decodedGroup  = decode_group_pkg(group)
  const decodedShare  = decode_share_pkg(share)

  const node = new BifrostNode(decodedGroup, decodedShare, relays)

  // Base events
  node.on('ready', () => console.log('Bifrost node is ready'))
  node.on('closed', () => console.log('Bifrost node is closed'))
  node.on('message', (msg: any) => console.log('Received message:', msg))
  node.on('bounced', ([reason, msg]: [string, any]) => console.log('Message bounced:', reason, msg))

  // ECDH events
  node.on('/ecdh/sender/req', (msg: any) => console.log('ECDH request sent:', msg))
  node.on('/ecdh/sender/res', (msgs: any[]) => console.log('ECDH responses received:', msgs))
  node.on('/ecdh/sender/rej', ([reason, pkg]: [string, any]) => console.log('ECDH request rejected:', reason, pkg))
  node.on('/ecdh/sender/ret', ([reason, pkgs]: [string, string]) => console.log('ECDH shares aggregated:', reason, pkgs))
  node.on('/ecdh/sender/err', ([reason, msgs]: [string, any[]]) => console.log('ECDH share aggregation failed:', reason, msgs))
  node.on('/ecdh/handler/req', (msg: any) => console.log('ECDH request received:', msg))
  node.on('/ecdh/handler/res', (msg: any) => console.log('ECDH response sent:', msg))
  node.on('/ecdh/handler/rej', ([reason, msg]: [string, any]) => console.log('ECDH rejection sent:', reason, msg))

  // Signature events
  node.on('/sign/sender/req', (msg: any) => console.log('Signature request sent:', msg))
  node.on('/sign/sender/res', (msgs: any[]) => console.log('Signature responses received:', msgs))
  node.on('/sign/sender/rej', ([reason, pkg]: [string, any]) => console.log('Signature request rejected:', reason, pkg))
  node.on('/sign/sender/ret', ([reason, msgs]: [string, SignatureEntry[]]) => console.log('Signature shares aggregated:', reason, msgs))
  node.on('/sign/sender/err', ([reason, msgs]: [string, any[]]) => console.log('Signature share aggregation failed:', reason, msgs))
  node.on('/sign/handler/req', (msg: any) => console.log('Signature request received:', msg))
  node.on('/sign/handler/res', (msg: any) => console.log('Signature response sent:', msg))
  node.on('/sign/handler/rej', ([reason, msg]: [string, any]) => console.log('Signature rejection sent:', reason, msg))

  return node
}

export function decode_share(share: string) {
  return decode_share_pkg(share)
}

export function decode_group(group: string) {
  return decode_group_pkg(group)
}

/**
 * Recovers the secret key from a group package and array of share packages
 * @param group The group package containing threshold signing parameters
 * @param shares Array of share packages containing the key shares
 * @returns The recovered secret key as a hex string
 */
export function recover_nsec(group: GroupPackage, shares: SharePackage[]): string {
  if (!group || !shares || shares.length === 0) {
    throw new Error('Group package and at least one share package are required');
  }

  if (shares.length < group.threshold) {
    throw new Error(`Not enough shares provided. Need at least ${group.threshold} shares`);
  }

  try {
    // todo: ??
    const hex_secret = recover_secret_key(group, shares);
    console.log('hex_secret', hex_secret)
    const secretBytes = Buffer.from(hex_secret, 'hex');
    console.log('secretBytes', secretBytes)
    console.log('nip19.nsecEncode(secretBytes)', nip19.nsecEncode(secretBytes))
    return nip19.nsecEncode(secretBytes)
  } catch (error: any) {
    throw new Error(`Failed to recover secret key: ${error.message}`);
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
