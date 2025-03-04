import { 
  encode_group_pkg,
  decode_group_pkg,
  encode_share_pkg, 
  decode_share_pkg,
  generate_dealer_pkg 
} from '@frostr/bifrost/lib'
import { BifrostNode } from '@frostr/bifrost'
import { nip19 } from 'nostr-tools'
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
  node.on('/ecdh/sender/sec', ([reason, pkgs]: [string, any[]]) => console.log('ECDH shares aggregated:', reason, pkgs))
  node.on('/ecdh/sender/err', ([reason, msgs]: [string, any[]]) => console.log('ECDH share aggregation failed:', reason, msgs))
  node.on('/ecdh/handler/req', (msg: any) => console.log('ECDH request received:', msg))
  node.on('/ecdh/handler/res', (msg: any) => console.log('ECDH response sent:', msg))
  node.on('/ecdh/handler/rej', ([reason, msg]: [string, any]) => console.log('ECDH rejection sent:', reason, msg))

  // Signature events
  node.on('/sign/sender/req', (msg: any) => console.log('Signature request sent:', msg))
  node.on('/sign/sender/res', (msgs: any[]) => console.log('Signature responses received:', msgs))
  node.on('/sign/sender/rej', ([reason, pkg]: [string, any]) => console.log('Signature request rejected:', reason, pkg))
  node.on('/sign/sender/sig', ([reason, msgs]: [string, any[]]) => console.log('Signature shares aggregated:', reason, msgs))
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

function validateKeysetParams(threshold: number, totalMembers: number) {
  if (threshold <= 0 || totalMembers <= 0) {
    throw new Error('Threshold and total members must be positive numbers');
  }
  if (threshold > totalMembers) {
    throw new Error('Threshold cannot be greater than total members');
  }
}
