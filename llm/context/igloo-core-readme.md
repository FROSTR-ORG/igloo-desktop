# @frostr/igloo-core

[![npm version](https://badge.fury.io/js/@frostr%2Figloo-core.svg)](https://badge.fury.io/js/@frostr%2Figloo-core)
[![npm downloads](https://img.shields.io/npm/dm/@frostr/igloo-core.svg)](https://www.npmjs.com/package/@frostr/igloo-core)
[![GitHub stars](https://img.shields.io/github/stars/FROSTR-ORG/igloo-core.svg)](https://github.com/FROSTR-ORG/igloo-core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/FROSTR-ORG/igloo-core/blob/main/LICENSE)

A TypeScript library providing core functionality for FROSTR/Bifrost distributed key management and remote signing. This library abstracts the complexity of threshold signatures and provides a clean, strongly-typed API for building secure distributed applications.

## Features

- 🔑 **Keyset Management**: Generate, decode, and manage threshold signature keysets using Shamir's Secret Sharing
- 🌐 **Node Management**: Create and manage BifrostNodes with comprehensive event handling
- 👥 **Peer Management**: Discover, monitor, and track peer status with automatic fallbacks
- 🛡️ **Policy Controls**: Configure per-peer send/receive permissions and audit signer access paths
- 🏓 **Ping Functionality**: Test peer connectivity and measure network latency
- 📡 **Echo Functionality**: QR code transfers and share confirmation with visual feedback
- 🔐 **Nostr Integration**: Complete nostr key management and format conversion utilities
- 🛡️ **Strong Types**: Full TypeScript support with comprehensive type definitions
- ⚡ **Error Handling**: Structured error types with detailed context
- 🔄 **Secret Recovery**: Secure threshold-based secret key reconstruction
- 🎯 **Validation**: Built-in validation for credentials, keys, and relay URLs

## Installation

```bash
npm install @frostr/igloo-core
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @frostr/bifrost nostr-tools
```

Or install everything at once:

```bash
npm install @frostr/igloo-core @frostr/bifrost nostr-tools
```

## Quick Start

### Basic Usage

```typescript
import { generateKeysetWithSecret, recoverSecretKeyFromCredentials } from '@frostr/igloo-core';

// Generate a 2-of-3 keyset from a secret key
const keyset = generateKeysetWithSecret(2, 3, 'your-hex-secret-key');

console.log('Generated keyset:', {
  group: keyset.groupCredential,
  shares: keyset.shareCredentials.length
});

// Recover the secret using threshold shares
const recoveredSecret = recoverSecretKeyFromCredentials(
  keyset.groupCredential,
  keyset.shareCredentials.slice(0, 2) // Use any 2 shares
);

console.log('Recovered secret:', recoveredSecret);
```

### Using the IglooCore Convenience Class

```typescript
import { IglooCore } from '@frostr/igloo-core';

const igloo = new IglooCore([
  'wss://relay.damus.io',
  'wss://relay.primal.net'
]);

// Generate keyset
const keyset = await igloo.generateKeyset(2, 3, secretKey);

// Create and connect a node
const node = await igloo.createNode(
  keyset.groupCredential,
  keyset.shareCredentials[0]
);

// Wait for echo confirmation (useful for QR code transfers)
const confirmed = await igloo.waitForEcho(
  keyset.groupCredential,
  keyset.shareCredentials[0],
  30000 // 30 second timeout
);

// Get share information
const shareInfo = await igloo.getShareInfo(keyset.shareCredentials[0]);
console.log(`Share ${shareInfo.idx}: threshold required for signing`);

// Or get full share details with group context
const fullShareInfo = await igloo.getShareDetailsWithGroup(
  keyset.shareCredentials[0], 
  keyset.groupCredential
);
console.log(`Share ${fullShareInfo.idx}: ${fullShareInfo.threshold}/${fullShareInfo.totalMembers}`);

// Convert between key formats  
const hexKey = await igloo.convertKey(nostrKeys.nsec, 'hex');
const npubFromHex = await igloo.convertKey(hexKey, 'npub');

// Enhanced node creation with state tracking
const { node: enhancedNode, state } = await igloo.createEnhancedNode(
  keyset.groupCredential,
  keyset.shareCredentials[0],
  ['wss://relay.damus.io'],
  { connectionTimeout: 10000, autoReconnect: true }
);
console.log('Node state:', state);
```

### Using the Default Instance

For simple use cases, you can use the pre-configured default instance:

```typescript
import { igloo } from '@frostr/igloo-core';

// Uses default relays: wss://relay.damus.io, wss://relay.primal.net
const keyset = await igloo.generateKeyset(2, 3, secretKey);
const node = await igloo.createNode(keyset.groupCredential, keyset.shareCredentials[0]);
```

## Core Functions

### Keyset Management

The primary purpose of this library is managing threshold signature keysets.

#### `generateKeysetWithSecret(threshold, totalMembers, secretKey)`

Generates a new keyset from a secret key using Shamir's Secret Sharing.

```typescript
import { generateKeysetWithSecret } from '@frostr/igloo-core';

const keyset = generateKeysetWithSecret(2, 3, 'your-hex-secret-key');
// Returns: { groupCredential: string, shareCredentials: string[] }
```

#### `recoverSecretKeyFromCredentials(groupCredential, shareCredentials)`

Recovers the original secret key from threshold shares.

```typescript
import { recoverSecretKeyFromCredentials } from '@frostr/igloo-core';

const nsec = recoverSecretKeyFromCredentials(
  groupCredential,
  shareCredentials.slice(0, threshold)
);
```

#### `getShareDetails(shareCredential)` / `getShareDetailsWithGroup(shareCredential, groupCredential)`

Gets information about a share including index and threshold parameters.

```typescript
import { getShareDetails, getShareDetailsWithGroup } from '@frostr/igloo-core';

// Basic share info (index only)
const details = getShareDetails(shareCredential);
console.log(`Share index: ${details.idx}`);

// Full share info with group context
const fullDetails = getShareDetailsWithGroup(shareCredential, groupCredential);
console.log(`Share ${fullDetails.idx}: ${fullDetails.threshold}/${fullDetails.totalMembers}`);
```

#### Advanced Keyset Functions

```typescript
import { 
  decodeShare, 
  decodeGroup, 
  validateSharesCompatibility,
  validateShareCredentialsCompatibility 
} from '@frostr/igloo-core';

// Decode credential structures for advanced use cases
const sharePackage = decodeShare(shareCredential);
const groupPackage = decodeGroup(groupCredential);

// Access raw threshold data
console.log('Threshold:', groupPackage.threshold);
console.log('Share index:', sharePackage.idx);

// Validate share compatibility
validateShareCredentialsCompatibility([
  shareCredential1, 
  shareCredential2
]);
```

#### Alternative Recovery Method

You can also use the lower-level `recoverSecretKey` function with decoded packages:

```typescript
import { recoverSecretKey, decodeGroup, decodeShare } from '@frostr/igloo-core';

const group = decodeGroup(groupCredential);
const shares = shareCredentials.map(decodeShare);

const nsec = recoverSecretKey(group, shares);
```

### Node Management

BifrostNodes handle the network communication for distributed signing.

#### `createAndConnectNode(config, eventConfig?)`

Creates and connects a BifrostNode. The returned Promise resolves when the node is ready for use.

```typescript
import { createAndConnectNode } from '@frostr/igloo-core';

const node = await createAndConnectNode({
  group: groupCredential,
  share: shareCredential,
  relays: ['wss://relay.damus.io']
}, {
  enableLogging: true,
  logLevel: 'info',
  customLogger: (level, message, data) => {
    console.log(`[${level}] ${message}`, data);
  }
});

// Node is ready immediately after Promise resolves
```

#### `createConnectedNode(config, eventConfig?)` - Enhanced Node Creation

Creates a node with enhanced state tracking and connection management.

```typescript
import { createConnectedNode } from '@frostr/igloo-core';

const result = await createConnectedNode({
  group: groupCredential,
  share: shareCredential,
  relays: ['wss://relay.damus.io'],
  connectionTimeout: 10000,
  autoReconnect: true
});

console.log('Node state:', result.state);
// State includes: isReady, isConnected, isConnecting, lastError, connectedRelays
```

#### Node Cleanup

Always clean up nodes when done to prevent memory leaks:

```typescript
import { cleanupBifrostNode } from '@frostr/igloo-core';

// Clean up properly - removes all event listeners and closes connections
cleanupBifrostNode(node);
```

#### Event Handling

The library automatically handles all Bifrost node events including:
- Base events: `ready`, `closed`, `message`, `error`, `info`, `debug`
- ECDH events: All sender and handler events with returns and errors
- Signature events: Complete signing workflow coverage
- Ping/Echo events: Full protocol support with error handling

```typescript
// Manual event handling if needed
node.on('/echo/sender/ret', (reason) => {
  console.log('Echo completed:', reason);
});

node.on('error', (error) => {
  console.error('Node error:', error);
});
```

### Echo Functionality

Echo functionality enables QR code transfers and confirmation that shares have been received.

#### `awaitShareEcho(groupCredential, shareCredential, options?)`

Waits for an echo event on a specific share.

```typescript
import { awaitShareEcho } from '@frostr/igloo-core';

try {
  const received = await awaitShareEcho(
    groupCredential,
    shareCredential,
    {
      relays: ['wss://relay.damus.io'],
      timeout: 30000,
      eventConfig: { enableLogging: true }
    }
  );
  console.log('Echo received!', received);
} catch (error) {
  console.log('No echo received within timeout');
}
```

#### `sendEcho(groupCredential, shareCredential, options?)` 

Send an echo signal to notify other devices that a share has been imported.

```typescript
import { sendEcho } from '@frostr/igloo-core';

try {
  const sent = await sendEcho(
    groupCredential,
    shareCredential,
    {
      relays: ['wss://relay.damus.io'],
      timeout: 10000
    }
  );
  console.log('Echo sent successfully!', sent);
} catch (error) {
  console.error('Failed to send echo:', error.message);
}
```

#### `startListeningForAllEchoes(groupCredential, shareCredentials, callback, options?)`

Starts listening for echo events on all shares in a keyset.

```typescript
import { startListeningForAllEchoes } from '@frostr/igloo-core';

const listener = startListeningForAllEchoes(
  groupCredential,
  shareCredentials,
  (shareIndex, shareCredential) => {
    console.log(`Echo received for share ${shareIndex}!`);
    // You can now notify your UI that this share was imported
  },
  {
    relays: ['wss://relay.damus.io'],
    eventConfig: { enableLogging: true }
  }
);

// Check if listener is active
console.log('Listener active:', listener.isActive);

// Cleanup when done
listener.cleanup();
```

### Nostr Utilities

Complete nostr key management and format conversion.

#### `generateNostrKeyPair()`

Generates a new nostr key pair with both nsec/npub and hex formats.

```typescript
import { generateNostrKeyPair } from '@frostr/igloo-core';

const keyPair = generateNostrKeyPair();
console.log({
  nsec: keyPair.nsec,           // nostr secret key
  npub: keyPair.npub,           // nostr public key
  hexPrivateKey: keyPair.hexPrivateKey,  // hex private key
  hexPublicKey: keyPair.hexPublicKey     // hex public key
});
```

#### Key Format Conversion

Convert between nsec/npub and hex formats:

```typescript
import { nsecToHex, hexToNsec, npubToHex, hexToNpub } from '@frostr/igloo-core';

// Private key conversion
const hexPrivateKey = nsecToHex('nsec1...');
const nsec = hexToNsec(hexPrivateKey);

// Public key conversion
const hexPublicKey = npubToHex('npub1...');
const npub = hexToNpub(hexPublicKey);
```

#### `derivePublicKey(privateKey)`

Derive the public key from a private key (supports both hex and nsec formats).

```typescript
import { derivePublicKey } from '@frostr/igloo-core';

const publicKeyInfo = derivePublicKey('nsec1...' /* or hex */);
console.log({
  npub: publicKeyInfo.npub,
  hexPublicKey: publicKeyInfo.hexPublicKey
});
```

## Peer Management

The library provides peer management capabilities for discovering and monitoring other participants in your signing group.

### Basic Peer Operations

```typescript
import { 
  extractPeersFromCredentials, 
  checkPeerStatus,
  createPeerManagerRobust 
} from '@frostr/igloo-core';

// Extract peer list from credentials
const peers = extractPeersFromCredentials(groupCredential, shareCredential);
console.log('Peers in group:', peers);

// Check current peer status
const peerStatus = await checkPeerStatus(node, groupCredential, shareCredential);
peerStatus.forEach(peer => {
  console.log(`${peer.pubkey}: ${peer.status}`);
});

// Create robust peer manager with automatic fallbacks
const result = await createPeerManagerRobust(node, groupCredential, shareCredential, {
  fallbackMode: 'static',  // Always provide peer list even if monitoring fails
  autoMonitor: true,
  suppressWarnings: true,  // Clean logging in production
  onError: (error, context) => {
    console.warn(`Peer issue in ${context}:`, error.message);
  }
});

if (result.success) {
  const status = result.peerManager.getPeerStatus();
  console.log(`✅ ${result.mode} mode: ${status.totalPeers} peers found`);
  
  if (result.mode === 'full') {
    console.log(`🟢 ${status.onlineCount} peers online`);
  }
  
  // Handle any warnings
  if (result.warnings?.length) {
    result.warnings.forEach(warning => console.warn('⚠️', warning));
  }
} else {
  console.error('❌ Peer management failed:', result.error);
}
```

### PeerManager Class

For advanced peer management with real-time monitoring:

```typescript
import { createPeerManager } from '@frostr/igloo-core';

const peerManager = await createPeerManager(
  node,
  groupCredential,
  shareCredential,
  {
    pingInterval: 30000,    // Ping every 30 seconds
    autoMonitor: true,
    onPeerStatusChange: (peer) => {
      console.log(`Peer ${peer.pubkey} is now ${peer.status}`);
    }
  }
);

// Get peer information
const allPeers = peerManager.getAllPeers();
const onlinePeers = peerManager.getOnlinePeers();
const isOnline = peerManager.isPeerOnline(peerPubkey);

// Manual ping
const pingResults = await peerManager.pingPeers();

// Cleanup when done
peerManager.cleanup();
```

### Pubkey Utilities

The library handles pubkey format normalization automatically throughout, but utilities are available:

```typescript
import { 
  normalizePubkey, 
  addPubkeyPrefix, 
  comparePubkeys,
  extractSelfPubkeyFromCredentials 
} from '@frostr/igloo-core';

// Normalize pubkeys (remove 02/03 prefix)
const normalized = normalizePubkey('02abcd1234...'); // Returns 'abcd1234...'

// Add prefix (convert to compressed format)
const withPrefix = addPubkeyPrefix('abcd1234...'); // Returns '02abcd1234...'

// Compare pubkeys (handles mixed formats)
const isMatch = comparePubkeys('02abcd1234...', 'abcd1234...'); // Returns true

// Extract self pubkey from credentials
const result = extractSelfPubkeyFromCredentials(groupCredential, shareCredential, {
  normalize: true,
  suppressWarnings: true
});
if (result.pubkey) {
  console.log('Self pubkey:', result.pubkey);
}
```

## Ping Functionality

Test peer connectivity and measure network latency.

```typescript
import { pingPeer, pingPeers, createPingMonitor } from '@frostr/igloo-core';

// Ping a single peer
const result = await pingPeer(node, peerPubkey, { timeout: 5000 });
if (result.success) {
  console.log(`Peer responded in ${result.latency}ms`);
  console.log(`Policy: send=${result.policy?.send}, recv=${result.policy?.recv}`);
} else {
  console.log(`Ping failed: ${result.error}`);
}

// Ping multiple peers
const results = await pingPeers(node, peerPubkeys, { timeout: 5000 });
const onlineCount = results.filter(r => r.success).length;
console.log(`${onlineCount}/${results.length} peers online`);

// Real-time monitoring
const monitor = createPingMonitor(node, peerPubkeys, {
  interval: 30000,
  timeout: 5000,
  onPingResult: (result) => {
    console.log(`${result.pubkey}: ${result.success ? 'online' : 'offline'}`);
  },
  onError: (error, context) => {
    console.warn('Monitor error:', error.message);
  }
});

monitor.start();
// Remember to monitor.stop() and monitor.cleanup() when done
```

### Advanced Ping Features

```typescript
import { runPingDiagnostics, pingPeersFromCredentials } from '@frostr/igloo-core';

// Network diagnostics with multiple rounds
const diagnostics = await runPingDiagnostics(node, peerPubkeys, {
  rounds: 3,
  interval: 2000,
  timeout: 5000
});

console.log(`Success rate: ${diagnostics.summary.successRate.toFixed(1)}%`);
console.log(`Average latency: ${diagnostics.summary.averageLatency.toFixed(1)}ms`);

// Ping peers extracted from credentials
const results = await pingPeersFromCredentials(groupCredential, shareCredential, {
  timeout: 5000,
  relays: ['wss://relay.damus.io']
});

```

## Policy Management

Configure directional policies that gate which peers your node will contact or accept requests from.

```typescript
import {
  setNodePolicies,
  getNodePolicies,
  canSendToPeer,
  canReceiveFromPeer
} from '@frostr/igloo-core';

// Seed policies during node creation using IglooCore
const igloo = new IglooCore();
const { node } = await igloo.createEnhancedNode(groupCredential, shareCredential, {
  relays: ['wss://relay.damus.io'],
  policies: [
    {
      pubkey: '02ab...ff',
      allowSend: false,
      allowReceive: true,
      label: 'Cold Storage Signer'
    }
  ],
  autoReconnect: true
});

// Update or merge policies at runtime
await setNodePolicies(node, [
  {
    pubkey: 'npub1example...',
    allowSend: true,
    allowReceive: false,
    note: 'Read-only peer'
  }
], { merge: true });

const policies = await getNodePolicies(node);
console.table(policies.map(({ pubkey, allowSend, allowReceive, status }) => ({ pubkey, allowSend, allowReceive, status })));

if (!await canSendToPeer(node, 'npub1example...')) {
  throw new Error('Outbound signing not permitted for this peer');
}

if (!await canReceiveFromPeer(node, 'npub1example...')) {
  console.warn('Incoming requests from peer will be rejected');
}
```

> Desktop Igloo persists policy overrides alongside each share. Share files written with version 1 now include a `policy` object recording the defaults (`allowSend`, `allowReceive`) plus optional peer-specific overrides keyed by normalized pubkeys. Legacy share files (missing a `policy` field or marked with a version less than 1) should be treated as allowing inbound and outbound traffic for every peer until the signer upgrades and saves the file.

## Validation

The library provides validation for all credential types and formats.

```typescript
import { 
  validateShare, 
  validateGroup, 
  validateRelay,
  validateCredentialSet,
  VALIDATION_CONSTANTS 
} from '@frostr/igloo-core';

// Individual validation
const shareResult = validateShare('bfshare1...');
const groupResult = validateGroup('bfgroup1...');
const relayResult = validateRelay('relay.damus.io');

console.log('Valid share:', shareResult.isValid);
console.log('Normalized relay:', relayResult.normalized); // 'wss://relay.damus.io'

// Batch validation
const result = validateCredentialSet({
  group: 'bfgroup1...',
  shares: ['bfshare1...', 'bfshare1...'],
  relays: ['relay.damus.io', 'wss://relay.primal.net']
});

console.log('All valid:', result.isValid);
if (!result.isValid) {
  console.log('Errors:', result.errors);
}

// Access validation constants
console.log('Share data size:', VALIDATION_CONSTANTS.SHARE_DATA_SIZE);
console.log('Prefixes:', {
  share: VALIDATION_CONSTANTS.BFSHARE_HRP,
  group: VALIDATION_CONSTANTS.BFGROUP_HRP
});
```

### Advanced Validation

```typescript
import { 
  validateWithOptions, 
  validateRelayList,
  validateMinimumShares,
  validateNsec,
  validateHexPrivkey,
  validateBfcred 
} from '@frostr/igloo-core';

// Validation with options
const validated = validateWithOptions({
  group: 'bfgroup1...',
  shares: ['bfshare1...'],
  relays: ['relay.damus.io']
}, {
  strict: true,
  normalizeRelays: true,
  requireMinShares: 2
});

// Individual credential validation
const nsecValid = validateNsec('nsec1...');
const hexValid = validateHexPrivkey('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa');
const bfcredValid = validateBfcred('bfcred1...');

// Minimum shares validation
const minSharesValid = validateMinimumShares(shareCredentials, 2);

// Relay list validation with normalization
const relayResult = validateRelayList([
  'relay.damus.io',
  'https://relay.primal.net/',
  'wss://relay.snort.social'
]);
console.log('Normalized relays:', relayResult.normalizedRelays);
console.log('Valid relays:', relayResult.validRelays);
console.log('Errors:', relayResult.errors);
```

## Error Handling

The library provides structured error types for better error handling:

```typescript
import { 
  KeysetError, 
  NodeError, 
  EchoError, 
  NostrError,
  BifrostValidationError 
} from '@frostr/igloo-core';

try {
  const keyset = generateKeysetWithSecret(5, 3, 'key'); // Invalid: threshold > total
} catch (error) {
  if (error instanceof KeysetError) {
    console.error('Keyset error:', error.message);
    console.error('Error code:', error.code);
    console.error('Details:', error.details);
  }
}

// Validation errors
try {
  validateShare('invalid-share');
} catch (error) {
  if (error instanceof BifrostValidationError) {
    console.error('Validation failed:', error.message);
    console.error('Field:', error.field);
  }
}
```

## React Integration Best Practices

### Proper Node Lifecycle Management

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { createAndConnectNode, cleanupBifrostNode } from '@frostr/igloo-core';

function MyComponent({ groupCredential, shareCredential }) {
  const [isConnected, setIsConnected] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    // Cleanup on unmount only
    return () => {
      if (nodeRef.current) {
        cleanupBifrostNode(nodeRef.current);
      }
    };
  }, []); // Empty dependency array is crucial

  const handleConnect = async () => {
    try {
      const node = await createAndConnectNode({
        group: groupCredential,
        share: shareCredential,
        relays: ['wss://relay.damus.io']
      });

      nodeRef.current = node;
      setIsConnected(true); // Node is ready immediately

      // Set up event listeners for state changes
      node.on('closed', () => setIsConnected(false));
      node.on('error', () => setIsConnected(false));

    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnected(false);
    }
  };

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <button onClick={handleConnect} disabled={isConnected}>
        Connect
      </button>
    </div>
  );
}
```

**⚠️ Important Notes**:
- The `'ready'` event may fire before your listeners are attached
- Always assume the node is ready when `createAndConnectNode()` resolves
- Use empty dependency arrays in useEffect to prevent cleanup loops
- Always clean up nodes to prevent memory leaks

### Complete React Example

```typescript
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { 
  createAndConnectNode, 
  cleanupBifrostNode, 
  validateShare, 
  validateGroup 
} from '@frostr/igloo-core';

export interface SignerHandle {
  stopSigner: () => Promise<void>;
}

interface SignerProps {
  groupCredential: string;
  shareCredential: string;
  relays: string[];
}

const Signer = forwardRef<SignerHandle, SignerProps>(({ 
  groupCredential, 
  shareCredential, 
  relays 
}, ref) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const nodeRef = useRef<any>(null);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (nodeRef.current) {
        cleanupBifrostNode(nodeRef.current);
      }
    };
  }, []);

  // Expose control methods to parent
  useImperativeHandle(ref, () => ({
    stopSigner: async () => {
      if (isRunning) {
        await handleStop();
      }
    }
  }));

  const handleStart = async () => {
    try {
      // Validate inputs first
      const shareValid = validateShare(shareCredential);
      const groupValid = validateGroup(groupCredential);
      
      if (!shareValid.isValid || !groupValid.isValid) {
        throw new Error('Invalid credentials');
      }

      setIsConnecting(true);
      setError(undefined);

      const node = await createAndConnectNode({
        group: groupCredential,
        share: shareCredential,
        relays
      });

      nodeRef.current = node;
      setIsRunning(true);
      setIsConnecting(false);

      // Set up listeners for state changes
      node.on('closed', () => {
        setIsRunning(false);
        setIsConnecting(false);
      });

      node.on('error', (error: any) => {
        setError(error.message);
        setIsRunning(false);
        setIsConnecting(false);
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsConnecting(false);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    try {
      if (nodeRef.current) {
        cleanupBifrostNode(nodeRef.current);
        nodeRef.current = null;
      }
      setIsRunning(false);
      setIsConnecting(false);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup error');
    }
  };

  return (
    <div>
      <div>
        Status: {isRunning ? 'Running' : isConnecting ? 'Connecting...' : 'Stopped'}
      </div>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      <button 
        onClick={isRunning ? handleStop : handleStart}
        disabled={isConnecting}
      >
        {isRunning ? 'Stop' : isConnecting ? 'Connecting...' : 'Start'} Signer
      </button>
    </div>
  );
});

export default Signer;
```

## Demo and Examples

Run the included demo to see all functionality in action:

```bash
# Clone the repository to run the demo
git clone https://github.com/FROSTR-ORG/igloo-core.git
cd igloo-core
npm install
npm run demo
```

The demo showcases:
- Keyset generation and recovery
- Echo functionality and timeouts
- Node management and connections
- Peer management and monitoring
- Error handling scenarios

### Additional Examples

The `examples/` directory contains comprehensive demonstrations:

```bash
# Run specific examples
npx ts-node --esm examples/ping-example.ts
npx ts-node --esm examples/peer-management.ts
npx ts-node --esm examples/validation-example.ts
```

## API Reference

### Main Exports

```typescript
// Main convenience class and default instance
export class IglooCore
export const igloo: IglooCore  // Pre-configured default instance

// Keyset functions
export function generateKeysetWithSecret(threshold: number, totalMembers: number, secretKey: string): KeysetCredentials
export function recoverSecretKeyFromCredentials(groupCredential: string, shareCredentials: string[]): string
export function recoverSecretKey(group: GroupPackage, shares: SharePackage[]): string
export function getShareDetails(shareCredential: string): ShareDetails
export function getShareDetailsWithGroup(shareCredential: string, groupCredential: string): ShareDetailsWithGroup
export function decodeShare(shareCredential: string): SharePackage
export function decodeGroup(groupCredential: string): GroupPackage
export function validateKeysetParams(params: KeysetParams): void
export function validateSecretKey(secretKey: string): void
export function validateSharesCompatibility(shares: SharePackage[]): void
export function validateShareCredentialsCompatibility(shareCredentials: string[]): void

// Node functions
export function createBifrostNode(config: NodeConfig, eventConfig?: NodeEventConfig): BifrostNode
export function createAndConnectNode(config: NodeConfig, eventConfig?: NodeEventConfig): Promise<BifrostNode>
export function createConnectedNode(config: EnhancedNodeConfig, eventConfig?: NodeEventConfig): Promise<NodeCreationResult>
export function connectNode(node: BifrostNode): Promise<void>
export function closeNode(node: BifrostNode): void
export function isNodeReady(node: BifrostNode): boolean
export function cleanupBifrostNode(node: BifrostNode): void
export function setupNodeEvents(node: BifrostNode, config: NodeEventConfig): void

// Echo functions
export function awaitShareEcho(groupCredential: string, shareCredential: string, options?: EchoOptions): Promise<boolean>
export function startListeningForAllEchoes(groupCredential: string, shareCredentials: string[], callback: EchoReceivedCallback, options?: EchoOptions): EchoListener
export function sendEcho(groupCredential: string, shareCredential: string, options?: EchoOptions): Promise<boolean>
export const DEFAULT_ECHO_RELAYS: string[]

// Nostr functions
export function generateNostrKeyPair(): NostrKeyPair
export function nsecToHex(nsec: string): string
export function hexToNsec(hex: string): string
export function npubToHex(npub: string): string
export function hexToNpub(hex: string): string
export function derivePublicKey(privateKey: string): { npub: string; hexPublicKey: string }
export function validateHexKey(hex: string, keyType?: 'private' | 'public'): void
export function validateNostrKey(key: string, expectedType?: 'nsec' | 'npub'): void

// Peer management functions
export class PeerManager
export class StaticPeerManager
export function createPeerManager(node: BifrostNode, groupCredential: string, shareCredential: string, config?: Partial<PeerMonitorConfig>): Promise<PeerManager>
export function createPeerManagerRobust(node: BifrostNode, groupCredential: string, shareCredential: string, config?: Partial<EnhancedPeerMonitorConfig>): Promise<PeerManagerResult>
export function extractPeersFromCredentials(groupCredential: string, shareCredential: string): string[]
export function checkPeerStatus(node: BifrostNode, groupCredential: string, shareCredential: string): Promise<{ pubkey: string; status: 'online' | 'offline' }[]>

// Pubkey utilities
export function normalizePubkey(pubkey: string): string
export function addPubkeyPrefix(pubkey: string, prefix?: '02' | '03'): string
export function comparePubkeys(pubkey1: string, pubkey2: string): boolean
export function extractSelfPubkeyFromCredentials(groupCredential: string, shareCredential: string, options?: { normalize?: boolean; suppressWarnings?: boolean }): { pubkey: string | null; warnings: string[] }

// Ping functions
export function pingPeer(node: BifrostNode, peerPubkey: string, options?: { timeout?: number; eventConfig?: NodeEventConfig }): Promise<PingResult>
export function pingPeers(node: BifrostNode, peerPubkeys: string[], options?: { timeout?: number; eventConfig?: NodeEventConfig }): Promise<PingResult[]>
export function createPingMonitor(node: BifrostNode, peerPubkeys: string[], config?: Partial<PingMonitorConfig>): PingMonitor
export function runPingDiagnostics(node: BifrostNode, peerPubkeys: string[], options?: { rounds?: number; timeout?: number; interval?: number; eventConfig?: NodeEventConfig }): Promise<DiagnosticsResult>
export function pingPeersFromCredentials(groupCredential: string, shareCredential: string, options?: { relays?: string[]; timeout?: number; eventConfig?: NodeEventConfig }): Promise<PingResult[]>
export const DEFAULT_PING_RELAYS: string[]
export const DEFAULT_PING_TIMEOUT: number
export const DEFAULT_PING_INTERVAL: number

// Validation functions
export function validateNsec(nsec: string): ValidationResult
export function validateHexPrivkey(hexPrivkey: string): ValidationResult
export function validateShare(share: string): ValidationResult
export function validateGroup(group: string): ValidationResult
export function validateRelay(relay: string): ValidationResult
export function validateBfcred(cred: string): ValidationResult
export function validateCredentialFormat(credential: string, type: 'share' | 'group' | 'cred'): ValidationResult
export function validateCredentialSet(credentials: { group: string; shares: string[]; relays: string[] }): CredentialSetValidationResult
export function validateRelayList(relays: string[]): RelayValidationResult
export function validateMinimumShares(shares: string[], requiredThreshold: number): ValidationResult
export function validateWithOptions(credentials: BifrostCredentials, options?: ValidationOptions): ValidatedCredentials
export const VALIDATION_CONSTANTS: ValidationConstants

// Error classes
export class IglooError extends Error
export class KeysetError extends IglooError
export class NodeError extends IglooError  
export class EchoError extends IglooError
export class RecoveryError extends IglooError
export class NostrError extends IglooError
export class BifrostValidationError extends IglooError
export class NostrValidationError extends IglooError
```

### Type Definitions

```typescript
export interface KeysetCredentials {
  groupCredential: string;
  shareCredentials: string[];
}

export interface ShareDetails {
  idx: number;
}

export interface ShareDetailsWithGroup {
  idx: number;
  threshold: number;
  totalMembers: number;
}

export interface KeysetParams {
  threshold: number;
  totalMembers: number;
}

export interface NostrKeyPair {
  nsec: string;
  npub: string;
  hexPrivateKey: string;
  hexPublicKey: string;
}

export interface NodeConfig {
  group: string;
  share: string;
  relays: string[];
}

export interface EnhancedNodeConfig extends NodeConfig {
  connectionTimeout?: number;
  autoReconnect?: boolean;
}

export interface NodeState {
  isReady: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  lastError?: string;
  connectedRelays: string[];
}

export interface Peer {
  pubkey: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen?: Date;
  latency?: number;
  allowSend: boolean;
  allowReceive: boolean;
}

export interface PingResult {
  success: boolean;
  pubkey: string;
  latency?: number;
  policy?: { send: boolean; recv: boolean };
  error?: string;
  timestamp: Date;
}

export interface PingMonitor {
  start: () => void;
  stop: () => void;
  isRunning: boolean;
  ping: () => Promise<PingResult[]>;
  cleanup: () => void;
}

export interface PingMonitorConfig {
  interval: number;
  timeout: number;
  onPingResult?: (result: PingResult) => void;
  onError?: (error: Error, context: string) => void;
  relays?: string[];
  eventConfig?: NodeEventConfig;
}

export interface PeerMonitorConfig {
  pingInterval: number;
  pingTimeout: number;
  autoMonitor: boolean;
  onPeerStatusChange?: (peer: Peer) => void;
  onError?: (error: Error, context: string) => void;
  enableLogging?: boolean;
  suppressWarnings?: boolean;
  customLogger?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void;
}

export interface PeerManagerResult {
  success: boolean;
  peerManager?: PeerManager | StaticPeerManager;
  mode: 'full' | 'static' | 'failed';
  warnings?: string[];
  error?: string;
}

export interface PeerValidationResult {
  isValid: boolean;
  peerCount: number;
  peers: string[];
  selfPubkey?: string;
  warnings: string[];
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  normalized?: string;
}

export interface RelayValidationResult extends ValidationResult {
  normalizedRelays?: string[];
  validRelays?: string[];
  errors?: string[];
}

export interface BifrostCredentials {
  group: string;
  shares: string[];
  relays: string[];
}

export interface ValidatedCredentials extends BifrostCredentials {
  isValid: boolean;
  errors: string[];
}

export interface EchoListener {
  cleanup: () => void;
  isActive: boolean;
}

export interface NodeEventConfig {
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  customLogger?: (level: string, message: string, data?: any) => void;
}
```

## Contributing

We welcome contributions to `@frostr/igloo-core`! Please see our [GitHub repository](https://github.com/FROSTR-ORG/igloo-core) for contribution guidelines.

## License

MIT 
