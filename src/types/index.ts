// Base types from igloo-core and bifrost
export interface DecodedShare {
  binder_sn: string;
  hidden_sn: string;
  idx: number;
  seckey: string;
}

export interface DecodedGroup {
  threshold: number;
  group_pk: string;
  commits: Array<{
    idx: number;
    pubkey: string;
    hidden_pn: string;
    binder_pn: string;
  }>;
  relays?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

// Igloo Share management types
export interface IglooShareMetadata {
  binder_sn?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface SharePolicyEntry {
  allowSend: boolean;
  allowReceive: boolean;
  updatedAt?: string;
}

export interface SharePolicy {
  defaults: SharePolicyEntry;
  peers?: Record<string, SharePolicyEntry>;
  updatedAt?: string;
}

export interface IglooShare {
  id: string;
  name: string;
  share: string;
  salt: string;
  groupCredential: string;
  version?: number;
  savedAt?: string;
  shareCredential?: string;
  metadata?: IglooShareMetadata;
  policy?: SharePolicy;
}

// Bifrost types (from @frostr/bifrost)
export interface SignatureEntry {
  id: string;
  pubkey: string;
  signature: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface ECDHPackage {
  type: 'ecdh';
  data: unknown;
  timestamp: number;
}

export interface SignSessionPackage {
  type: 'sign';
  data: unknown;
  timestamp: number;
}

// Bifrost Node types
export interface BifrostNode {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  disconnect: () => Promise<void>;
  // Add other node methods as needed
}

export interface NodeState {
  isReady: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connectedRelays: string[];
}

export interface ConnectedNodeResult {
  node: BifrostNode;
  state: NodeState;
}

// Event Log types
export interface LogEntryData {
  timestamp: string;
  type: string;
  message: string;
  data?: unknown;
  id: string;
}

// Bifrost message types
export interface BifrostMessage {
  id?: string;
  tag?: string;
  content?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ECDHMessage extends BifrostMessage {
  type: 'ecdh';
}

export interface SignMessage extends BifrostMessage {
  type: 'sign';
}

// Console types for error handling
export interface ConsoleWarnOverride {
  (message: string, ...args: unknown[]): void;
}

// Generic data structure for rendering
export type RenderableData = DecodedGroup | DecodedShare | Record<string, unknown>;

// Signer types
export interface SignerHandle {
  stopSigner: () => Promise<void>;
}

export interface SignerInitialData {
  decryptedShare: string;
  groupCredential: string;
  shareRecord?: IglooShare;
  threshold?: number;
  totalShares?: number;
  /**
   * @deprecated Backward-compatible alias for decryptedShare
   */
  share?: string;
  /**
   * @deprecated Backward-compatible alias for shareRecord.name
   */
  name?: string;
}

export interface SignerProps {
  initialData?: SignerInitialData | null;
}

// Keyset types
export interface KeysetProps {
  groupCredential: string;
  shareCredentials: string[];
  name: string;
  onFinish?: () => void;
}

// Recovery types
export interface RecoverProps {
  initialShare?: string;
  initialGroupCredential?: string;
  defaultThreshold?: number;
  defaultTotalShares?: number;
}

// Noble crypto library types for test mocks
export interface NobleHashFunction {
  (data: Uint8Array): Uint8Array;
}

export interface NoblePBKDF2Options {
  c: number;
  dkLen: number;
}

export interface NobleCipher {
  encrypt: (data: Uint8Array) => Uint8Array;
  decrypt: (data: Uint8Array) => Uint8Array;
}

// Event handler types
export type EventCallback<T = unknown> = (data: T) => void;
export type BifrostEventCallback = (reason: string, data: BifrostMessage) => void;
export type ECDHEventCallback = (data: ECDHMessage | ECDHMessage[]) => void;
export type SignEventCallback = (data: SignMessage | SignMessage[]) => void; 
