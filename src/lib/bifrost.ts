import { BifrostNode, SignatureEntry, PackageEncoder } from '@frostr/bifrost'
import { generate_dealer_pkg, recover_secret_key } from '@frostr/bifrost/lib'
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
  return PackageEncoder.cred.encode(groupPkg, sharePkg);
}

/**
 * Decodes a bfcred string into its constituent group and share packages.
 * @param credStr The bfcred encoded string.
 * @returns An object containing the group and share packages.
 */
export function decode_credential_string(credStr: string): { group: GroupPackage, share: SharePackage } {
  return PackageEncoder.cred.decode(credStr);
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
 * Uses Bifrost ping functionality to confirm network readiness for a given credential.
 * Initializes a BifrostNode with the provided credential and performs a self-ping.
 * 
 * @param credentialData The bfcred string containing group and share packages.
 * @param relays Optional array of relay URLs to use. Defaults to ["wss://relay.damus.io"].
 * @param operationTimeout Optional timeout in milliseconds for the entire operation (node ready + ping). Defaults to 30000ms.
 * @returns Promise that resolves to true if the self-ping is successful, rejects otherwise.
 */
export function pingShare(
  credentialData: string,
  relays: string[] = ["wss://relay.damus.io"],
  operationTimeout: number = 30000
): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    let node: BifrostNode | null = null;
    let timer: NodeJS.Timeout | null = null;
    let hasCleanedUp = false;

    const cleanupAndReject = (reason: string, error?: any) => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;
      
      console.log(`[pingShare] Cleaning up and rejecting. Reason: ${reason}`);
      if (error) console.error(`[pingShare] Associated error:`, error);

      if (timer) clearTimeout(timer);
      timer = null;

      if (node) {
        const tempNode = node;
        node = null; // Prevent re-entrancy if close is synchronous and emits events
        if (typeof (tempNode as any).removeAllListeners === 'function') {
          (tempNode as any).removeAllListeners();
        }
        try {
          (tempNode as any).close();
          console.log('[pingShare] BifrostNode closed via cleanupAndReject.');
        } catch (closeError) {
          console.error('[pingShare] Error during node.close() in cleanupAndReject:', closeError);
        }
      }
      reject(new Error(`[pingShare] ${reason}`));
    };

    const cleanupAndResolve = (reason: string) => {
      if (hasCleanedUp) return;
      hasCleanedUp = true;

      console.log(`[pingShare] Cleaning up and resolving. Reason: ${reason}`);
      if (timer) clearTimeout(timer);
      timer = null;

      if (node) {
        const tempNode = node;
        node = null;
        if (typeof (tempNode as any).removeAllListeners === 'function') {
          (tempNode as any).removeAllListeners();
        }
        try {
          (tempNode as any).close();
          console.log('[pingShare] BifrostNode closed via cleanupAndResolve.');
        } catch (closeError) {
          console.error('[pingShare] Error during node.close() in cleanupAndResolve:', closeError);
        }
      }
      resolve(true);
    };

    timer = setTimeout(() => {
      cleanupAndReject(`Operation timed out after ${operationTimeout}ms`);
    }, operationTimeout);

    try {
      console.log('[pingShare] Decoding credential string...');
      const { group, share } = PackageEncoder.cred.decode(credentialData);
      const groupId = (group as any).id;
      console.log(`[pingShare] Credential decoded. Group ID: ${groupId}, Share Index: ${share.idx}`);

      if (!relays || relays.length === 0) {
        cleanupAndReject('At least one relay URL must be provided');
        return;
      }
      
      console.log('[pingShare] Initializing BifrostNode with relays:', relays);
      node = new BifrostNode(group, share, relays);
      const nodeId = (node as any).id as string;
      const nodeRelays = (node as any).relays as string[] | undefined;

      node.on('ready', async () => {
        if (hasCleanedUp) return; // Already handled by timeout or other error
        console.log(`[pingShare] BifrostNode ready. Node ID (pubkey): ${nodeId}. Performing self-ping...`);
        if (!nodeId) {
          cleanupAndReject('Node became ready but ID is missing.');
          return;
        }
        try {
          const pingRelaysToUse = Array.isArray(nodeRelays) && nodeRelays.length > 0 ? nodeRelays : relays;
          const pingTimeout = operationTimeout / 2; // Use a portion for the ping itself
          await (node as any).ping(nodeId, pingRelaysToUse, pingTimeout); 
          cleanupAndResolve('Self-ping successful.');
        } catch (pingError: any) {
          cleanupAndReject(`Self-ping failed: ${pingError.message || String(pingError)}`, pingError);
        }
      });

      node.on('error', (err: any) => {
        if (hasCleanedUp) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        cleanupAndReject(`BifrostNode error: ${errorMessage}`, err);
      });

      node.on('closed', () => {
        // This event can be triggered by an explicit node.close() or an unexpected disconnection.
        // If hasCleanedUp is false, it means it was likely an unexpected closure.
        if (!hasCleanedUp) {
          console.log('[pingShare] BifrostNode connection closed unexpectedly event received.');
          cleanupAndReject('BifrostNode connection closed unexpectedly');
        } else {
          console.log("[pingShare] BifrostNode 'closed' event received after cleanup initiated.");
        }
      });

    } catch (error: any) {
      // This catches errors from PackageEncoder.cred.decode or BifrostNode constructor
      const errorMessage = error instanceof Error ? error.message : String(error);
      cleanupAndReject(`Setup error: ${errorMessage}`, error);
    }
  });
}
