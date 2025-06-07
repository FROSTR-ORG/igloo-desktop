export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
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
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  
  return {
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumbers && hasSpecialChars,
    hasMinLength,
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
  minLength: 8,
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
 * Validates if a string is a valid hostname
 * @param hostname - The hostname to validate
 * @returns boolean indicating if the hostname is valid
 */
function isValidHostname(hostname: string): boolean {
  // Check for basic invalid cases
  if (!hostname || hostname.length === 0) return false;
  if (hostname.startsWith('.') || hostname.endsWith('.')) return false;
  if (hostname.includes('..')) return false;
  
  // Valid hostname patterns:
  // - Domain names: example.com, relay.nostr.com, sub.domain.example.com
  // - IP addresses: 192.168.1.1, 127.0.0.1
  // - Localhost: localhost
  // - With port: example.com:8080, 192.168.1.1:7777
  
  // Split hostname and port if present
  const parts = hostname.split(':');
  if (parts.length > 2) return false; // Too many colons
  
  const host = parts[0];
  const port = parts[1];
  
  // Validate port if present
  if (port) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return false;
  }
  
  // Validate the host part
  // Check if it's an IP address
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipPattern.test(host)) {
    // Validate IP address ranges
    const ipParts = host.split('.').map(Number);
    return ipParts.every(part => part >= 0 && part <= 255);
  }
  
  // Special case for localhost
  if (host === 'localhost') return true;
  
  // Check if it's a valid domain name with at least one dot (for relay URLs we expect proper domains)
  if (!host.includes('.')) {
    // Single-label hostnames are generally not valid for WebSocket relays
    // except for special cases like localhost (handled above)
    return false;
  }
  
  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;
  if (!domainPattern.test(host)) return false;
  
  // Additional checks for domain names
  const labels = host.split('.');
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
      const hostname = urlObj.port ? `${urlObj.hostname}:${urlObj.port}` : urlObj.hostname;
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