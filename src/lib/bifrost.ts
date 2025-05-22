import { BifrostNode, SignatureEntry, PackageEncoder, ECDHPackage, SignSessionPackage } from '@frostr/bifrost'
import { generate_dealer_pkg, recover_secret_key } from '@frostr/bifrost/lib'
import { encode_credentials, decode_credentials } from '@frostr/bifrost/encoder'
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

  const { group, shares } = generate_dealer_pkg(
    threshold,
    totalMembers,
    [secretKey]
  )

  // Encode the group and shares as bech32 strings
  return {
    groupCredential: PackageEncoder.group.encode(group),
    shareCredentials: shares.map((share: SharePackage) => PackageEncoder.share.encode(share))
  }
}

export function get_node ({ group, share, relays }: { group: string, share: string, relays: string[] }) {
  if (!relays || relays.length === 0) {
    throw new Error('At least one relay URL must be provided')
  }

  const decodedGroup = PackageEncoder.group.decode(group)
  const decodedShare = PackageEncoder.share.decode(share)

  const node = new BifrostNode(decodedGroup, decodedShare, relays)

  // Base events
  node.on('ready', () => console.log('Bifrost node is ready'))
  node.on('closed', () => console.log('Bifrost node is closed'))
  node.on('message', (msg: any) => console.log('Received message:', msg))
  node.on('bounced', (reason: string, msg: any) => console.log('Message bounced:', reason, msg))

  // ECDH events
  node.on('/ecdh/sender/req', (msg: any) => console.log('ECDH request sent:', msg))
  node.on('/ecdh/sender/res', (...msgs: any[]) => console.log('ECDH responses received:', msgs))
  node.on('/ecdh/sender/rej', (reason: string, pkg: ECDHPackage) => console.log('ECDH request rejected:', reason, pkg))
  node.on('/ecdh/sender/ret', (reason: string, pkgs: string) => console.log('ECDH shares aggregated:', reason, pkgs))
  node.on('/ecdh/sender/err', (reason: string, msgs: any[]) => console.log('ECDH share aggregation failed:', reason, msgs))
  node.on('/ecdh/handler/req', (msg: any) => console.log('ECDH request received:', msg))
  node.on('/ecdh/handler/res', (msg: any) => console.log('ECDH response sent:', msg))
  node.on('/ecdh/handler/rej', (reason: string, msg: any) => console.log('ECDH rejection sent:', reason, msg))

  // Signature events
  node.on('/sign/sender/req', (msg: any) => console.log('Signature request sent:', msg))
  node.on('/sign/sender/res', (...msgs: any[]) => console.log('Signature responses received:', msgs))
  node.on('/sign/sender/rej', (reason: string, pkg: SignSessionPackage) => console.log('Signature request rejected:', reason, pkg))
  node.on('/sign/sender/ret', (reason: string, msgs: SignatureEntry[]) => console.log('Signature shares aggregated:', reason, msgs))
  node.on('/sign/sender/err', (reason: string, msgs: any[]) => console.log('Signature share aggregation failed:', reason, msgs))
  node.on('/sign/handler/req', (msg: any) => console.log('Signature request received:', msg))
  node.on('/sign/handler/res', (msg: any) => console.log('Signature response sent:', msg))
  node.on('/sign/handler/rej', (reason: string, msg: any) => console.log('Signature rejection sent:', reason, msg))

  return node
}

export function decode_share(share: string): SharePackage {
  return PackageEncoder.share.decode(share)
}

export function decode_group(group: string): GroupPackage {
  return PackageEncoder.group.decode(group)
}

/**
 * Encodes a group and share package into a single bfcred string.
 * @param groupPkg The group package.
 * @param sharePkg The share package.
 * @returns The bfcred encoded string.
 */
export function encode_credential_string(groupPkg: GroupPackage, sharePkg: SharePackage): string {
  return encode_credentials(groupPkg, sharePkg);
}

/**
 * Decodes a bfcred string into its constituent group and share packages.
 * @param credStr The bfcred encoded string.
 * @returns An object containing the group and share packages.
 */
export function decode_credential_string(credStr: string): { group: GroupPackage, share: SharePackage } {
  return decode_credentials(credStr);
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

/**
 * A temporary mock of a ping response for QR code sharing
 * 
 * In a real implementation, this would use actual Bifrost ping functionality
 * when it becomes available in the library
 * 
 * @param credentialData The bfcred string
 * @param timeout Timeout in milliseconds
 * @returns Promise that resolves when the "ping" is successful
 */
export function pingShare(credentialData: string, relays: string[] = ["wss://relay.damus.io"], timeout = 30000): Promise<boolean> {
  // This is a mock implementation that simulates a response after a delay
  // In a real implementation, this would use actual Bifrost protocol communication
  // You might want to decode and use parts of the credential for actual ping logic:
  // const { group, share } = decode_credential_string(credentialData);
  // console.log('Pinging with credential for group id:', group.id, 'and share index:', share.idx, 'on relays:', relays);
  
  return new Promise((resolve, reject) => {
    // For demonstration purposes, we'll just resolve after a random delay
    // In reality, this would involve actual network communication with a device
    // that scanned the QR code
    const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds delay
    
    setTimeout(() => {
      // 50% chance of success for demo purposes
      const isSuccess = Math.random() < 0.5;
      
      if (isSuccess) {
        resolve(true);
      } else {
        reject(new Error("Failed to receive ping confirmation"));
      }
    }, delay);
  });
}
