/**
 * Tests for validation utilities
 *
 * These tests verify the centralized validation functions used across the application
 * for input validation, SSRF protection, and error sanitization.
 */

import {
  VALIDATION_LIMITS,
  validatePassword,
  validatePositiveInteger,
  validateShareName,
  sanitizeUserError,
  validatePasswordLength,
  formatRelayUrl,
} from '../../lib/validation';

describe('VALIDATION_LIMITS', () => {
  it('should define password limits', () => {
    expect(VALIDATION_LIMITS.PASSWORD_MIN).toBe(8);
    expect(VALIDATION_LIMITS.PASSWORD_MAX).toBe(256);
  });

  it('should define name limits', () => {
    expect(VALIDATION_LIMITS.NAME_MIN).toBe(1);
    expect(VALIDATION_LIMITS.NAME_MAX).toBe(255);
  });

  it('should define threshold limits', () => {
    expect(VALIDATION_LIMITS.THRESHOLD_MIN).toBe(2);
    expect(VALIDATION_LIMITS.THRESHOLD_MAX).toBe(100);
  });

  it('should define total keys limits', () => {
    expect(VALIDATION_LIMITS.TOTAL_KEYS_MIN).toBe(2);
    expect(VALIDATION_LIMITS.TOTAL_KEYS_MAX).toBe(100);
  });
});

describe('validatePassword', () => {
  it('should validate strong passwords', () => {
    const result = validatePassword('StrongPass1!');
    expect(result.isValid).toBe(true);
    expect(result.hasMinLength).toBe(true);
    expect(result.hasMaxLength).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasLowercase).toBe(true);
    expect(result.hasNumbers).toBe(true);
    expect(result.hasSpecialChars).toBe(true);
  });

  it('should reject short passwords', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(false);
  });

  it('should reject overly long passwords', () => {
    const longPassword = 'A'.repeat(257) + 'a1!';
    const result = validatePassword(longPassword);
    expect(result.isValid).toBe(false);
    expect(result.hasMaxLength).toBe(false);
  });

  it('should accept passwords at max length', () => {
    const maxPassword = 'Aa1!' + 'x'.repeat(252);
    const result = validatePassword(maxPassword);
    expect(result.hasMaxLength).toBe(true);
    expect(result.hasMinLength).toBe(true);
  });
});

describe('validatePasswordLength', () => {
  it('should accept valid passwords', () => {
    const result = validatePasswordLength('password123');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject empty passwords', () => {
    const result = validatePasswordLength('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password is required');
  });

  it('should reject short passwords', () => {
    const result = validatePasswordLength('short');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('at least');
  });

  it('should reject overly long passwords', () => {
    const result = validatePasswordLength('x'.repeat(257));
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('or less');
  });
});

describe('validatePositiveInteger', () => {
  it('should accept valid integers', () => {
    const result = validatePositiveInteger('5', 1, 10, 'Value');
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(5);
    expect(result.error).toBeUndefined();
  });

  it('should accept minimum value', () => {
    const result = validatePositiveInteger(2, 2, 100, 'Threshold');
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(2);
  });

  it('should accept maximum value', () => {
    const result = validatePositiveInteger(100, 2, 100, 'Threshold');
    expect(result.isValid).toBe(true);
    expect(result.value).toBe(100);
  });

  it('should reject empty strings', () => {
    const result = validatePositiveInteger('', 1, 10, 'Value');
    expect(result.isValid).toBe(false);
    expect(result.value).toBeNull();
    expect(result.error).toContain('required');
  });

  it('should reject whitespace-only strings', () => {
    const result = validatePositiveInteger('   ', 1, 10, 'Value');
    expect(result.isValid).toBe(false);
    expect(result.value).toBeNull();
  });

  it('should reject NaN', () => {
    const result = validatePositiveInteger('abc', 1, 10, 'Value');
    expect(result.isValid).toBe(false);
    expect(result.value).toBeNull();
    expect(result.error).toContain('valid number');
  });

  it('should reject Infinity', () => {
    const result = validatePositiveInteger(Infinity, 1, 10, 'Value');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('valid number');
  });

  it('should reject negative Infinity', () => {
    const result = validatePositiveInteger(-Infinity, 1, 10, 'Value');
    expect(result.isValid).toBe(false);
  });

  it('should reject values below minimum', () => {
    const result = validatePositiveInteger(1, 2, 100, 'Threshold');
    expect(result.isValid).toBe(false);
    expect(result.value).toBe(1);
    expect(result.error).toContain('at least 2');
  });

  it('should reject values above maximum', () => {
    const result = validatePositiveInteger(101, 2, 100, 'Threshold');
    expect(result.isValid).toBe(false);
    expect(result.value).toBe(101);
    expect(result.error).toContain('at most 100');
  });

  it('should reject non-integer values', () => {
    const result = validatePositiveInteger(3.5, 1, 10, 'Value');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('whole number');
  });

  it('should handle negative numbers', () => {
    const result = validatePositiveInteger(-5, 1, 10, 'Value');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('at least');
  });
});

describe('validateShareName', () => {
  it('should accept valid names', () => {
    const result = validateShareName('My Keyset', []);
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('My Keyset');
  });

  it('should reject empty names', () => {
    const result = validateShareName('', []);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should reject whitespace-only names', () => {
    const result = validateShareName('   ', []);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should reject duplicate names', () => {
    const result = validateShareName('Existing', ['Existing']);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('should normalize names by removing " share " suffix', () => {
    const result = validateShareName('Test share 1', ['Test']);
    expect(result.isValid).toBe(false);
    expect(result.normalized).toBe('Test');
  });

  it('should reject names exceeding max length', () => {
    const longName = 'x'.repeat(256);
    const result = validateShareName(longName, []);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('255');
  });

  it('should accept names at max length', () => {
    const maxName = 'x'.repeat(255);
    const result = validateShareName(maxName, []);
    expect(result.isValid).toBe(true);
  });

  it('should trim whitespace before validation', () => {
    const result = validateShareName('  My Keyset  ', []);
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('My Keyset');
  });
});

describe('sanitizeUserError', () => {
  it('should handle non-Error objects', () => {
    const result = sanitizeUserError('just a string');
    expect(result).toBe('An unexpected error occurred');
  });

  it('should sanitize decode errors', () => {
    const result = sanitizeUserError(new Error('Failed to decode bech32'));
    expect(result).toBe('Invalid credential format');
  });

  it('should sanitize parse errors', () => {
    const result = sanitizeUserError(new Error('JSON parse failed'));
    expect(result).toBe('Invalid credential format');
  });

  it('should sanitize checksum errors', () => {
    const result = sanitizeUserError(new Error('checksum mismatch'));
    expect(result).toBe('Credential checksum failed - data may be corrupted');
  });

  it('should sanitize length errors', () => {
    const result = sanitizeUserError(new Error('Invalid length'));
    expect(result).toBe('Input data has invalid length');
  });

  it('should sanitize encryption errors', () => {
    const result = sanitizeUserError(new Error('decrypt failed'));
    expect(result).toBe('Encryption/decryption operation failed');
  });

  it('should return generic message for unknown errors', () => {
    const result = sanitizeUserError(new Error('Some random error'));
    expect(result).toBe('Operation failed. Please check your input and try again.');
  });

  it('should handle null and undefined', () => {
    expect(sanitizeUserError(null)).toBe('An unexpected error occurred');
    expect(sanitizeUserError(undefined)).toBe('An unexpected error occurred');
  });
});

describe('SSRF Protection in formatRelayUrl', () => {
  it('should block localhost', () => {
    const result = formatRelayUrl('wss://localhost:8080');
    expect(result.isValid).toBe(false);
  });

  it('should block 127.0.0.1 loopback', () => {
    const result = formatRelayUrl('wss://127.0.0.1');
    expect(result.isValid).toBe(false);
  });

  it('should block 10.x.x.x private range', () => {
    const result = formatRelayUrl('wss://10.0.0.1');
    expect(result.isValid).toBe(false);
  });

  it('should block 172.16-31.x.x private range', () => {
    expect(formatRelayUrl('wss://172.16.0.1').isValid).toBe(false);
    expect(formatRelayUrl('wss://172.31.255.255').isValid).toBe(false);
    // 172.15 and 172.32 should be allowed (not in private range)
    expect(formatRelayUrl('wss://172.15.0.1').isValid).toBe(true);
    expect(formatRelayUrl('wss://172.32.0.1').isValid).toBe(true);
  });

  it('should block 192.168.x.x private range', () => {
    const result = formatRelayUrl('wss://192.168.1.1');
    expect(result.isValid).toBe(false);
  });

  it('should block 169.254.x.x link-local', () => {
    const result = formatRelayUrl('wss://169.254.1.1');
    expect(result.isValid).toBe(false);
  });

  it('should block 0.x.x.x reserved range', () => {
    const result = formatRelayUrl('wss://0.0.0.1');
    expect(result.isValid).toBe(false);
  });

  it('should allow public IP addresses', () => {
    expect(formatRelayUrl('wss://8.8.8.8').isValid).toBe(true);
    expect(formatRelayUrl('wss://203.0.113.50').isValid).toBe(true);
  });

  it('should allow public domain names', () => {
    expect(formatRelayUrl('wss://relay.damus.io').isValid).toBe(true);
    expect(formatRelayUrl('wss://nos.lol').isValid).toBe(true);
  });
});
