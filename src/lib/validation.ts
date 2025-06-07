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
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
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
    if (!formatted.includes('.') || formatted.includes(' ')) {
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

  // Strict validation
  const wsProtocolPattern = /^wss?:\/\//;
  const validHostPattern = /^wss?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:\/[^?\s]*)?$/;
  
  const isValid = wsProtocolPattern.test(formatted) && 
                 validHostPattern.test(formatted) && 
                 formatted.length > 6 &&
                 !formatted.includes(' ') &&
                 formatted !== 'wss://' && 
                 formatted !== 'ws://';
  
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