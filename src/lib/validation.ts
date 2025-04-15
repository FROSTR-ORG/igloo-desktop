import { nip19 } from 'nostr-tools';
import React from 'react';

// Constants from Bifrost library (https://github.com/FROSTR-ORG/bifrost/blob/master/src/const.ts)
// These are the exact binary sizes before bech32 encoding
const SHARE_DATA_SIZE = 100;  // Exact binary size of a share
const SHARE_INDEX_SIZE = 4;   // Size of share index
const SHARE_SECKEY_SIZE = 32; // Size of share secret key
const SHARE_SNONCE_SIZE = 32; // Size of share nonce

const GROUP_DATA_SIZE = 37;   // Base size of a group
const GROUP_PUBKEY_SIZE = 33; // Size of group public key
const GROUP_THOLD_SIZE = 4;   // Size of threshold value
const COMMIT_DATA_SIZE = 103; // Size of each commitment

// Calculate expected bech32 encoded lengths (approximate)
// Bech32 encoding: 8 bits -> 5 bits, so length increases by factor of 8/5 = 1.6
// Plus prefix ('bfshare' or 'bfgroup') and checksum (typ. 6 chars)
const MIN_BFSHARE_LENGTH = Math.floor(SHARE_DATA_SIZE * 1.6) + 'bfshare'.length + 6; // ~172 chars
const MAX_BFSHARE_LENGTH = MIN_BFSHARE_LENGTH + 10; // Allow some flexibility

// For groups, size depends on number of commits (n in m-of-n)
// Base size + at least one commit
const MIN_BFGROUP_LENGTH = Math.floor((GROUP_DATA_SIZE + COMMIT_DATA_SIZE) * 1.6) + 'bfgroup'.length + 6; // ~234 chars
// Maximum reasonable number of commits (e.g., 15-of-15 would be a large setup)
const MAX_COMMITS = 15;
const MAX_BFGROUP_LENGTH = Math.floor((GROUP_DATA_SIZE + (COMMIT_DATA_SIZE * MAX_COMMITS)) * 1.6) + 'bfgroup'.length + 6;

/**
 * Validates a nostr secret key (nsec) format
 * @param nsec The string to validate as nsec
 * @returns Validation result object
 */
export function validateNsec(nsec: string): { isValid: boolean; message?: string } {
  if (!nsec || !nsec.trim()) {
    return { isValid: false, message: 'Nsec is required' };
  }

  try {
    const { type, data } = nip19.decode(nsec);
    if (type !== 'nsec') {
      return { isValid: false, message: 'Invalid nsec format' };
    }
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      message: 'Invalid nsec format' 
    };
  }
}

/**
 * Validates a hex private key format
 * @param hexPrivkey The string to validate as hex privkey
 * @returns Validation result object
 */
export function validateHexPrivkey(hexPrivkey: string): { isValid: boolean; message?: string } {
  if (!hexPrivkey || !hexPrivkey.trim()) {
    return { isValid: false, message: 'Private key is required' };
  }

  // Check if it's a valid hex string of correct length (64 characters for 32 bytes)
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(hexPrivkey)) {
    return { isValid: false, message: 'Invalid hex private key format (should be 64 hex characters)' };
  }

  return { isValid: true };
}

/**
 * Validates a Bifrost share format
 * @param share The string to validate as a Bifrost share
 * @returns Validation result object
 */
export function validateShare(share: string): { isValid: boolean; message?: string } {
  if (!share || !share.trim()) {
    return { isValid: false, message: 'Share is required' };
  }

  // Basic prefix check
  if (!share.startsWith('bfshare')) {
    return { isValid: false, message: 'Invalid share format (should start with bfshare)' };
  }
  
  // Length check based on expected bech32 encoded share
  if (share.length < MIN_BFSHARE_LENGTH || share.length > MAX_BFSHARE_LENGTH) {
    return { 
      isValid: false, 
      message: `Invalid share length (expected around ${MIN_BFSHARE_LENGTH} characters)` 
    };
  }

  // Don't use nip19.decode for bech32m validation - it's incompatible
  // Instead, use basic format checks and rely on Bifrost's decoder for deep validation
  
  // Basic format check - bech32m has a similar format to bech32:
  // [prefix]1[data][checksum] - the '1' separates the human-readable part from the data
  const formatCheck = /^bfshare1[023456789acdefghjklmnpqrstuvwxyz]+$/;
  if (!formatCheck.test(share)) {
    return {
      isValid: false,
      message: 'Invalid share format - must be in bech32m format'
    };
  }
  
  // Leave deeper validation to the Bifrost decoder function
  return { isValid: true };
}

/**
 * Validates a Bifrost group format
 * @param group The string to validate as a Bifrost group
 * @returns Validation result object
 */
export function validateGroup(group: string): { isValid: boolean; message?: string } {
  if (!group || !group.trim()) {
    return { isValid: false, message: 'Group is required' };
  }

  // Basic prefix check
  if (!group.startsWith('bfgroup')) {
    return { isValid: false, message: 'Invalid group format (should start with bfgroup)' };
  }
  
  // Length check based on expected bech32 encoded group
  if (group.length < MIN_BFGROUP_LENGTH) {
    return { 
      isValid: false, 
      message: `Invalid group length (expected at least ${MIN_BFGROUP_LENGTH} characters)` 
    };
  }
  
  if (group.length > MAX_BFGROUP_LENGTH) {
    return {
      isValid: false,
      message: `Group credential too long (maximum expected length is ${MAX_BFGROUP_LENGTH} characters)`
    };
  }

  // Don't use nip19.decode for bech32m validation - it's incompatible
  // Instead, use basic format checks and rely on Bifrost's decoder for deep validation
  
  // Basic format check - bech32m has a similar format to bech32:
  // [prefix]1[data][checksum] - the '1' separates the human-readable part from the data
  const formatCheck = /^bfgroup1[023456789acdefghjklmnpqrstuvwxyz]+$/;
  if (!formatCheck.test(group)) {
    return {
      isValid: false,
      message: 'Invalid group format - must be in bech32m format'
    };
  }
  
  // Leave deeper validation to the Bifrost decoder function
  return { isValid: true };
}

/**
 * Validates a nostr relay URL
 * @param relay The string to validate as a relay URL
 * @returns Validation result object
 */
export function validateRelay(relay: string): { isValid: boolean; message?: string; normalized?: string } {
  if (!relay || !relay.trim()) {
    return { isValid: false, message: 'Relay URL is required' };
  }

  // Normalize the relay URL
  let normalized = relay.trim();
  
  // Replace http:// or https:// with wss://, or add wss:// if no protocol is present
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    // Extract the part after the protocol
    const urlWithoutProtocol = normalized.split('//')[1];
    normalized = `wss://${urlWithoutProtocol}`;
  } else if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
    normalized = `wss://${normalized}`;
  }
  
  // Remove trailing slash if present
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  try {
    // Check if it's a valid URL
    const url = new URL(normalized);
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
      return { isValid: false, message: 'Relay URL must use wss:// or ws:// protocol' };
    }
    
    return { 
      isValid: true,
      normalized
    };
  } catch (error) {
    return { 
      isValid: false, 
      message: 'Invalid relay URL format' 
    };
  }
}

/**
 * A reusable form input component factory with validation
 * @param value The current value
 * @param validator The validation function to use
 * @returns An object with validation state and handler
 */
export function useFormInput<T>(
  initialValue: string,
  validator: (value: string) => { isValid: boolean; message?: string; normalized?: string }
) {
  const [value, setValue] = React.useState(initialValue);
  const [isValid, setIsValid] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);
  const [normalized, setNormalized] = React.useState<string | undefined>(undefined);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    const result = validator(newValue);
    setIsValid(result.isValid);
    setErrorMessage(result.message);
    setNormalized(result.normalized);
  };

  React.useEffect(() => {
    // Validate initial value
    if (initialValue) {
      const result = validator(initialValue);
      setIsValid(result.isValid);
      setErrorMessage(result.message);
      setNormalized(result.normalized);
    }
  }, [initialValue]);

  return {
    value,
    isValid,
    errorMessage,
    normalized,
    handleChange
  };
} 