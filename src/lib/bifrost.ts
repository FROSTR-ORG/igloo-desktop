import { BifrostNode, SignatureEntry, PackageEncoder, ECDHPackage, SignSessionPackage } from '@frostr/bifrost'
import { generate_dealer_pkg, recover_secret_key } from '@frostr/bifrost/lib'
import { nip19 } from 'nostr-tools'
import type {
  GroupPackage,
  SharePackage
} from '@frostr/bifrost'

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
  node.on('ready', (node: BifrostNode) => console.log('Bifrost node is ready, node:', node))
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
  
  // ping events
  node.on('/ping/handler/req', (msg: any) => console.log('Ping request received:', msg))
  node.on('/ping/handler/res', (msg: any) => console.log('Ping response sent:', msg))
  node.on('/ping/handler/rej', (reason: string, msg: any) => console.log('Ping rejection sent:', reason, msg))
  node.on('/ping/sender/req', (msg: any) => console.log('Ping request sent:', msg))
  node.on('/ping/sender/res', (msg: any) => console.log('Ping response received:', msg))
  node.on('/ping/sender/rej', (reason: string, msg: any) => console.log('Ping request rejected:', reason, msg))

  // echo events
  node.on('/echo/handler/req', (msg: any) => console.log('Echo request received:', msg))
  node.on('/echo/handler/res', (msg: any) => console.log('Echo response sent:', msg))
  node.on('/echo/handler/rej', (reason: string, msg: any) => console.log('Echo rejection sent:', reason, msg))
  node.on('/echo/sender/req', (msg: any) => console.log('Echo request sent:', msg))
  node.on('/echo/sender/res', (msg: any) => console.log('Echo response received:', msg))
  node.on('/echo/sender/rej', (reason: string, msg: any) => console.log('Echo request rejected:', reason, msg))

  return node
}

export function decode_share(share: string): SharePackage {
  return PackageEncoder.share.decode(share)
}

export function decode_group(group: string): GroupPackage {
  return PackageEncoder.group.decode(group)
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
 * Waits for an echo event on a specific share.
 * This function sets up a Bifrost node to listen for an incoming echo request,
 * which signals that another device has successfully imported and is interacting with the share.
 *
 * @param groupCredential The bfgroup string for the keyset.
 * @param shareCredential The bfshare string being shared (e.g., via QR).
 * @param relays Optional array of relay URLs to use.
 * @param timeout Optional timeout in milliseconds to wait for the echo.
 * @returns Promise that resolves to true if an echo is successfully received, or rejects on timeout/error.
 */
export function awaitShareEcho(groupCredential: string, shareCredential: string, relays: string[] = ["wss://relay.damus.io", "wss://relay.primal.net"], timeout = 30000): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    let node: BifrostNode | null = null;
    let timeoutId_for_promise_itself: NodeJS.Timeout | null = null;

    // Define handlers to allow removal in cleanup
    const onMessageHandler = (messagePayload: any) => {
      const shareDetails = decode_share(shareCredential);
      // Check if the message is the specific echo we are waiting for
      if (messagePayload && messagePayload.data === 'echo' && messagePayload.tag === '/echo/req') {
        console.log(`[awaitShareEcho] DEBUG: Relevant 'message' event (echo request) received. Share Index: ${shareDetails.idx}. Payload:`, messagePayload);
        resolve(true);
        cleanup();
      } else {
        // Log other messages if needed for debugging, but don't resolve/reject unless it's our target echo
        // console.log(`[awaitShareEcho] INFO: Received other message type. Share Index: ${shareDetails.idx}. Payload:`, messagePayload);
      }
    };

    const onClosedHandler = () => {
      const shareDetails = decode_share(shareCredential);
      console.log(`[awaitShareEcho] Node connection closed for share index: ${shareDetails.idx}.`);
      if (timeoutId_for_promise_itself) { // Check if promise is still pending
        reject(new Error('Connection closed before echo was received'));
        cleanup();
      }
    };

    const onErrorHandler = (errorPayload: unknown) => {
      const shareDetails = decode_share(shareCredential);
      console.error(`[awaitShareEcho] Node error for share index: ${shareDetails.idx}:`, errorPayload);
      if (timeoutId_for_promise_itself) { // Check if promise is still pending
         reject(new Error(`Node error: ${errorPayload}`))
         cleanup();
      }
    };

    const cleanup = () => {
      if (timeoutId_for_promise_itself) {
        clearTimeout(timeoutId_for_promise_itself);
        timeoutId_for_promise_itself = null;
      }
      if (node) {
        // Detach specific listeners
        node.off('message', onMessageHandler);
        node.off('closed', onClosedHandler);
        node.off('error', onErrorHandler);
        // Detach wildcard if it was programmatically added and needs removal
        // For now, assuming user's added '*' listener is ad-hoc for debugging
        node.close();
        node = null;
      }
    };

    try {
      console.log(`[awaitShareEcho] Getting node for share: ${shareCredential} using relays: ${relays.join(', ')}`);
      node = get_node({ group: groupCredential, share: shareCredential, relays });

      // Attach listeners BEFORE connecting
      // We listen to the generic 'message' event because, in this specific QR code context,
      // the BifrostNode instance emits this event with the echo payload,
      // rather than a more specific '/echo/handler/req' event.
      node.on('message', onMessageHandler);
      node.on('closed', onClosedHandler);
      node.on('error', onErrorHandler);

      timeoutId_for_promise_itself = setTimeout(() => {
        const shareDetails = decode_share(shareCredential);
        console.warn(`[awaitShareEcho] Overall operation timed out after ${timeout/1000}s for share index: ${shareDetails.idx}`);
        reject(new Error(`No echo received within ${timeout / 1000} seconds (overall timeout)`));
        cleanup();
      }, timeout);

      console.log(`[awaitShareEcho] Connecting node to relays...`);
      await node.connect();
      console.log(`[awaitShareEcho] Node connected. Listening for incoming echo.`);

    } catch (error: any) {
      console.error('[awaitShareEcho] General error during setup or connection:', error);
      reject(error); 
      cleanup(); 
    }
  });
}

/**
 * Starts listening for echo events on all shares in a keyset.
 * Creates one BifrostNode per share to listen for incoming echo requests.
 * This is useful for detecting when shares have been imported on other devices.
 *
 * @param groupCredential The bfgroup string for the keyset.
 * @param shareCredentials Array of bfshare strings to listen for echoes on.
 * @param relays Array of relay URLs to use.
 * @param onEchoReceived Callback function called when an echo is received for a share.
 * @returns Cleanup function that stops all listeners and closes connections.
 */
export function startListeningForAllEchoes(
  groupCredential: string,
  shareCredentials: string[],
  relays: string[] = ["wss://relay.damus.io", "wss://relay.primal.net"],
  onEchoReceived: (shareIndex: number, shareCredential: string) => void
): () => void {
  const nodes: BifrostNode[] = [];
  const cleanupFunctions: (() => void)[] = [];

  console.log(`[startListeningForAllEchoes] Starting echo listeners for ${shareCredentials.length} shares`);

  shareCredentials.forEach((shareCredential, index) => {
    try {
      const node = get_node({ group: groupCredential, share: shareCredential, relays });
      nodes.push(node);

      // Create message handler for this specific share
      const onMessageHandler = (messagePayload: any) => {
        if (messagePayload && messagePayload.data === 'echo' && messagePayload.tag === '/echo/req') {
          const shareDetails = decode_share(shareCredential);
          console.log(`[startListeningForAllEchoes] Echo received for share ${index} (idx: ${shareDetails.idx})`);
          onEchoReceived(index, shareCredential);
        }
      };

      const onErrorHandler = (errorPayload: unknown) => {
        const shareDetails = decode_share(shareCredential);
        console.error(`[startListeningForAllEchoes] Error on share ${index} (idx: ${shareDetails.idx}):`, errorPayload);
      };

      const onClosedHandler = () => {
        const shareDetails = decode_share(shareCredential);
        console.log(`[startListeningForAllEchoes] Connection closed for share ${index} (idx: ${shareDetails.idx})`);
      };

      // Attach listeners
      node.on('message', onMessageHandler);
      node.on('error', onErrorHandler);
      node.on('closed', onClosedHandler);

      // Connect the node
      node.connect().catch(error => {
        console.error(`[startListeningForAllEchoes] Failed to connect node for share ${index}:`, error);
      });

      // Create cleanup function for this node
      const cleanup = () => {
        try {
          node.off('message', onMessageHandler);
          node.off('error', onErrorHandler);
          node.off('closed', onClosedHandler);
          node.close();
        } catch (error) {
          console.error(`[startListeningForAllEchoes] Error cleaning up node for share ${index}:`, error);
        }
      };

      cleanupFunctions.push(cleanup);

    } catch (error) {
      console.error(`[startListeningForAllEchoes] Failed to create node for share ${index}:`, error);
    }
  });

  // Return master cleanup function
  return () => {
    console.log(`[startListeningForAllEchoes] Cleaning up all echo listeners`);
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}
