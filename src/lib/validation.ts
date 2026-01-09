/**
 * Centralized validation limits for consistent enforcement across the application
 */
export const VALIDATION_LIMITS = {
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 256,
  /** Sanity limit for decrypting legacy shares - prevents memory issues from accidental large pastes */
  PASSWORD_LEGACY_MAX: 65536,
  NAME_MIN: 1,
  NAME_MAX: 255,
  THRESHOLD_MIN: 2,
  THRESHOLD_MAX: 100,
  TOTAL_KEYS_MIN: 2,
  TOTAL_KEYS_MAX: 100,
} as const;

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasMaxLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
}

/**
 * Validates password strength according to application requirements
 * @param password - The password to validate
 * @returns PasswordValidationResult object with validation details
 */
export function validatePassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= VALIDATION_LIMITS.PASSWORD_MIN;
  const hasMaxLength = password.length <= VALIDATION_LIMITS.PASSWORD_MAX;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  return {
    isValid: hasMinLength && hasMaxLength && hasUppercase && hasLowercase && hasNumbers && hasSpecialChars,
    hasMinLength,
    hasMaxLength,
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSpecialChars
  };
}

/**
 * Password validation requirements for display purposes
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: VALIDATION_LIMITS.PASSWORD_MIN,
  maxLength: VALIDATION_LIMITS.PASSWORD_MAX,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialCharsPattern: '[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?]'
} as const;

export interface RelayUrlValidationResult {
  isValid: boolean;
  formatted: string;
  message?: string;
}

export interface SaltValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  isHexadecimal: boolean;
  message?: string;
}

/**
 * Salt validation requirements for display purposes
 */
export const SALT_REQUIREMENTS = {
  minLength: 16, // Minimum 16 hex characters (8 bytes)
  hexPattern: /^[0-9a-fA-F]+$/
} as const;

/**
 * Validates a salt value according to application requirements
 * @param salt - The salt to validate
 * @returns SaltValidationResult object with validation details
 */
export function validateSalt(salt: string): SaltValidationResult {
  if (!salt || typeof salt !== 'string') {
    return {
      isValid: false,
      hasMinLength: false,
      isHexadecimal: false,
      message: 'Salt is required'
    };
  }

  const hasMinLength = salt.length >= SALT_REQUIREMENTS.minLength;
  const isHexadecimal = SALT_REQUIREMENTS.hexPattern.test(salt);
  
  let message: string | undefined;
  if (!isHexadecimal) {
    message = 'Salt must contain only hexadecimal characters (0-9, a-f, A-F)';
  } else if (!hasMinLength) {
    message = `Salt must be at least ${SALT_REQUIREMENTS.minLength} characters long`;
  }

  return {
    isValid: hasMinLength && isHexadecimal,
    hasMinLength,
    isHexadecimal,
    message
  };
}

/**
 * Validates if a string is a proper salt value
 * @param salt - The salt to validate
 * @returns boolean indicating if the salt is valid
 */
export function isValidSalt(salt: string): boolean {
  return validateSalt(salt).isValid;
}

/**
 * Converts a hex IPv4-mapped IPv6 suffix (e.g., "7f00:1") to dotted decimal ("127.0.0.1")
 * IPv4-mapped format after Node normalization: ::ffff:XXXX:XXXX where X are hex digits
 * The last 32 bits (two 16-bit groups) represent the IPv4 address
 */
function hexToIpv4(hexPart: string): string | null {
  // Handle formats like "7f00:1" (127.0.0.1) or "c0a8:101" (192.168.1.1)
  const parts = hexPart.split(':');
  if (parts.length !== 2) return null;

  const high = parseInt(parts[0], 16);
  const low = parseInt(parts[1], 16);

  if (isNaN(high) || isNaN(low) || high > 0xffff || low > 0xffff) return null;

  // Convert to IPv4 octets
  const octet1 = (high >> 8) & 0xff;
  const octet2 = high & 0xff;
  const octet3 = (low >> 8) & 0xff;
  const octet4 = low & 0xff;

  return `${octet1}.${octet2}.${octet3}.${octet4}`;
}

/**
 * Checks if an IPv6 address is in a private or reserved range (SSRF protection)
 * @param ip - The IPv6 address to check (e.g., "::1", "fe80::1")
 * @returns true if the IP is private/reserved and should be blocked
 */
function isPrivateOrReservedIpv6(ip: string): boolean {
  // Normalize the address to lowercase for comparison
  const normalized = ip.toLowerCase();

  // Loopback (::1)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified address (::)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // Link-local (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

  // Unique local addresses (fc00::/7 - includes fc00::/8 and fd00::/8)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // IPv4-mapped IPv6 addresses - Node normalizes these to hex format (::ffff:XXXX:XXXX)
  // e.g., ::ffff:127.0.0.1 becomes ::ffff:7f00:1
  const ipv4MappedHexMatch = normalized.match(/^::ffff:([0-9a-f]+:[0-9a-f]+)$/);
  if (ipv4MappedHexMatch) {
    const ipv4 = hexToIpv4(ipv4MappedHexMatch[1]);
    if (ipv4) {
      return isPrivateOrReservedIpv4(ipv4);
    }
  }

  // IPv4-compatible IPv6 addresses (deprecated) - also normalized to hex (::XXXX:XXXX)
  // e.g., ::127.0.0.1 becomes ::7f00:1
  const ipv4CompatHexMatch = normalized.match(/^::([0-9a-f]+:[0-9a-f]+)$/);
  if (ipv4CompatHexMatch) {
    const ipv4 = hexToIpv4(ipv4CompatHexMatch[1]);
    if (ipv4) {
      return isPrivateOrReservedIpv4(ipv4);
    }
  }

  // Also check dotted-decimal format in case it's not normalized (defensive)
  const ipv4MappedDotMatch = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4MappedDotMatch) {
    return isPrivateOrReservedIpv4(ipv4MappedDotMatch[1]);
  }

  const ipv4CompatDotMatch = normalized.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4CompatDotMatch) {
    return isPrivateOrReservedIpv4(ipv4CompatDotMatch[1]);
  }

  return false;
}

/**
 * Checks if an IPv4 address is in a private or reserved range (SSRF protection)
 * @param ip - The IPv4 address to check (e.g., "192.168.1.1")
 * @returns true if the IP is private/reserved and should be blocked
 */
function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false; // Invalid IP format - let other validation handle it
  }

  // RFC 1918 private ranges
  if (parts[0] === 10) return true;                                      // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true;                 // 192.168.0.0/16

  // Loopback
  if (parts[0] === 127) return true;                                     // 127.0.0.0/8

  // Link-local
  if (parts[0] === 169 && parts[1] === 254) return true;                 // 169.254.0.0/16

  // Reserved
  if (parts[0] === 0) return true;                                       // 0.0.0.0/8

  return false;
}

/**
 * Checks if an IP address (IPv4 or IPv6) is in a private or reserved range (SSRF protection)
 * @param ip - The IP address to check (e.g., "192.168.1.1", "::1", "fe80::1")
 * @returns true if the IP is private/reserved and should be blocked
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // Check if it's an IPv6 address (contains colons)
  if (ip.includes(':')) {
    return isPrivateOrReservedIpv6(ip);
  }

  // Otherwise treat as IPv4
  return isPrivateOrReservedIpv4(ip);
}

/**
 * Validates if a string is a valid hostname for WebSocket relay URLs.
 * This function receives the hostname portion from URL parsing (without port).
 * For IPv6 addresses, the URL parser strips brackets, so "::1" not "[::1]".
 *
 * @param hostname - The hostname to validate (no port)
 * @returns boolean indicating if the hostname is valid
 */
function isValidHostname(hostname: string): boolean {
  // Check for basic invalid cases
  if (!hostname || hostname.length === 0) return false;

  // SSRF Protection: Block localhost
  if (hostname === 'localhost') return false;

  // Check if it's an IPv6 address first (contains colons)
  // Note: URL parser strips brackets, so we receive raw IPv6 like "::1" or "2001:db8::1"
  if (hostname.includes(':')) {
    // Basic IPv6 format validation (hex digits and colons only)
    const ipv6Pattern = /^[a-fA-F0-9:]+$/;
    if (!ipv6Pattern.test(hostname)) return false;

    // SSRF Protection: Block private/reserved IPv6 ranges
    if (isPrivateOrReservedIp(hostname)) return false;

    return true;
  }

  // Domain/IPv4 validation (no colons)
  if (hostname.startsWith('.') || hostname.endsWith('.')) return false;
  if (hostname.includes('..')) return false;

  // Check if it's an IPv4 address
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    // Validate IP address ranges
    const ipParts = hostname.split('.').map(Number);
    if (!ipParts.every(part => part >= 0 && part <= 255)) return false;

    // SSRF Protection: Block private/reserved IP ranges
    if (isPrivateOrReservedIp(hostname)) return false;

    return true;
  }

  // Check if it's a valid domain name with at least one dot (for relay URLs we expect proper domains)
  if (!hostname.includes('.')) {
    // Single-label hostnames are generally not valid for WebSocket relays
    // except for special cases like localhost (handled above)
    return false;
  }

  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;
  if (!domainPattern.test(hostname)) return false;

  // Additional checks for domain names
  const labels = hostname.split('.');
  if (labels.length < 2) return false; // Must have at least domain.tld

  return labels.every(label => {
    // Each label should be 1-63 characters
    if (label.length === 0 || label.length > 63) return false;
    // Each label should not start or end with hyphen
    if (label.startsWith('-') || label.endsWith('-')) return false;
    // Each label should be alphanumeric with hyphens
    return /^[a-zA-Z0-9-]+$/.test(label);
  });
}

/**
 * Formats a relay URL according to application standards
 * @param url - The URL to format
 * @returns RelayUrlValidationResult with formatted URL and validation info
 */
export function formatRelayUrl(url: string): RelayUrlValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      formatted: '',
      message: 'URL is required'
    };
  }

  const original = url;
  let formatted = url.trim();
  
  // Check if it's empty after trimming
  if (!formatted) {
    return {
      isValid: false,
      formatted: '',
      message: 'URL is required'
    };
  }
  
  // Check for invalid protocols first (before we potentially add wss://)
  if (original.startsWith('http://') || original.startsWith('https://') || original.startsWith('ftp://')) {
    return {
      isValid: false,
      formatted: original,
      message: 'Must be a WebSocket URL (ws:// or wss://)'
    };
  }
  
  // Add protocol if missing (only for URLs that don't already have a protocol)
  if (!formatted.startsWith('ws://') && !formatted.startsWith('wss://')) {
    // Don't add protocol if it looks like it's just an invalid string
    if (formatted.includes(' ') || !isValidHostname(formatted)) {
      return {
        isValid: false,
        formatted: original,
        message: 'Invalid URL format'
      };
    }
    formatted = `wss://${formatted}`;
  }
  
  // Remove trailing slash (except for root URLs)
  if (formatted.endsWith('/') && formatted !== 'wss://' && formatted !== 'ws://') {
    formatted = formatted.slice(0, -1);
  }

  // Strict validation using URL parsing
  let isValid = false;
  try {
    const urlObj = new URL(formatted);

    // Check protocol
    if (urlObj.protocol !== 'ws:' && urlObj.protocol !== 'wss:') {
      isValid = false;
    } else {
      // Validate the hostname part
      // Note: Node's URL parser keeps brackets for IPv6 (e.g., "[::1]").
      // Strip them for validation since isValidHostname expects raw IP.
      let hostname = urlObj.hostname;
      if (hostname.startsWith('[') && hostname.endsWith(']')) {
        hostname = hostname.slice(1, -1);
      }
      isValid = isValidHostname(hostname) &&
                formatted.length > 6 &&
                !formatted.includes(' ') &&
                formatted !== 'wss://' &&
                formatted !== 'ws://';
    }
  } catch {
    isValid = false;
  }
  
  return {
    isValid,
    formatted,
    message: isValid ? undefined : 'Invalid WebSocket URL format'
  };
}

/**
 * Validates if a URL is a proper WebSocket relay URL
 * @param url - The URL to validate
 * @returns boolean indicating if the URL is valid
 */
export function isValidRelayUrl(url: string): boolean {
  return formatRelayUrl(url).isValid;
}

// ============================================================================
// Numeric Validation
// ============================================================================

export interface NumericValidationResult {
  isValid: boolean;
  value: number | null;
  error?: string;
}

/**
 * Validates that input is a positive integer within specified bounds
 * Handles NaN, Infinity, empty strings, and non-integer values safely
 *
 * @param input - The string or number to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param fieldName - Name of the field for error messages
 * @returns NumericValidationResult with validation status and parsed value
 */
export function validatePositiveInteger(
  input: string | number,
  min: number,
  max: number,
  fieldName: string
): NumericValidationResult {
  // Handle empty string case
  if (typeof input === 'string' && input.trim() === '') {
    return { isValid: false, value: null, error: `${fieldName} is required` };
  }

  // Parse the input
  const num = typeof input === 'string' ? parseInt(input, 10) : input;

  // Check for NaN and Infinity
  if (!Number.isFinite(num)) {
    return { isValid: false, value: null, error: `${fieldName} must be a valid number` };
  }

  // Check for non-integer values
  if (!Number.isInteger(num)) {
    return { isValid: false, value: null, error: `${fieldName} must be a whole number` };
  }

  // Check bounds
  if (num < min) {
    return { isValid: false, value: num, error: `${fieldName} must be at least ${min}` };
  }

  if (num > max) {
    return { isValid: false, value: num, error: `${fieldName} must be at most ${max}` };
  }

  return { isValid: true, value: num };
}

// ============================================================================
// Name Validation
// ============================================================================

export interface NameValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Validates a share/keyset name with length limits and duplicate detection
 *
 * @param name - The name to validate
 * @param existingNames - Array of existing names to check for duplicates
 * @param maxLength - Maximum allowed length (default: VALIDATION_LIMITS.NAME_MAX)
 * @returns NameValidationResult with validation status and normalized name
 */
export function validateShareName(
  name: string,
  existingNames: string[],
  maxLength: number = VALIDATION_LIMITS.NAME_MAX
): NameValidationResult {
  const trimmed = name.trim();

  // Check for empty/whitespace-only input
  if (trimmed.length === 0) {
    return { isValid: false, normalized: '', error: 'Name is required' };
  }

  // Check length limit
  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      normalized: trimmed,
      error: `Name must be ${maxLength} characters or less`
    };
  }

  // Normalize: strip trailing " share N" suffix if present (e.g., "My Keyset share 1" -> "My Keyset")
  // Use regex to only match the specific pattern at the end, not arbitrary occurrences
  const normalized = trimmed.replace(/ share \d+$/i, '').trim() || trimmed;

  // Check for duplicates
  if (existingNames.includes(normalized)) {
    return { isValid: false, normalized, error: 'This name already exists' };
  }

  return { isValid: true, normalized };
}

// ============================================================================
// Error Sanitization
// ============================================================================

/**
 * Sanitizes error messages for display to users
 * Prevents leaking internal implementation details or stack traces
 *
 * @param error - The error to sanitize
 * @returns A user-friendly error message
 */
export function sanitizeUserError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred';
  }

  const msg = error.message.toLowerCase();

  // Map known error patterns to user-friendly messages
  if (msg.includes('decode') || msg.includes('parse') || msg.includes('invalid bech32')) {
    return 'Invalid credential format';
  }

  if (msg.includes('checksum')) {
    return 'Credential checksum failed - data may be corrupted';
  }

  if (msg.includes('length') || msg.includes('size')) {
    return 'Input data has invalid length';
  }

  if (msg.includes('encrypt') || msg.includes('decrypt')) {
    return 'Encryption/decryption operation failed';
  }

  // Default - don't expose raw message
  return 'Operation failed. Please check your input and try again.';
}

/**
 * Simple password validation for components that don't need full strength requirements
 * Only checks length bounds, not complexity
 *
 * @param password - The password to validate
 * @returns Object with isValid flag and optional error message
 */
export function validatePasswordLength(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < VALIDATION_LIMITS.PASSWORD_MIN) {
    return {
      isValid: false,
      error: `Password must be at least ${VALIDATION_LIMITS.PASSWORD_MIN} characters`
    };
  }

  if (password.length > VALIDATION_LIMITS.PASSWORD_MAX) {
    return {
      isValid: false,
      error: `Password must be ${VALIDATION_LIMITS.PASSWORD_MAX} characters or less`
    };
  }

  return { isValid: true };
}
