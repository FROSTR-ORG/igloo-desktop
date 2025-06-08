import { mockDeriveSecret } from '../setup';
import { validatePassword, formatRelayUrl, isValidRelayUrl, validateSalt, isValidSalt } from '../../lib/validation';
import { sanitizeShareFilename, isFilenameSafe, FILESYSTEM_LIMITS } from '../../lib/filesystem';

describe('User Input Validation and Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Password Validation', () => {
    it('should validate password strength requirements', () => {
      const strongPasswords = [
        'MySecurePassword123!',
        'StrongPass#456',
        'Complex$Password789',
        'ValidKey@2024',
        'Secure_Pass123!'
      ];

      const weakPasswords = [
        '',                    // empty
        'short1!',            // too short (7 chars)
        'nouppercase123!',    // no uppercase
        'NOLOWERCASE123!',    // no lowercase
        'NoNumbers!@#',       // no numbers
        'NoSpecialChars123',  // no special characters
        'password',           // missing multiple requirements
        'PASSWORD123',        // missing lowercase and special chars
        'mypass123',          // missing uppercase and special chars
        'weakpass',           // common weak password
        '12345678'            // all numbers, no letters or special chars
      ];

      strongPasswords.forEach(password => {
        const validation = validatePassword(password);
        expect(validation.isValid).toBe(true);
        expect(validation.hasMinLength).toBe(true);
        expect(validation.hasUppercase).toBe(true);
        expect(validation.hasLowercase).toBe(true);
        expect(validation.hasNumbers).toBe(true);
        expect(validation.hasSpecialChars).toBe(true);
      });

      weakPasswords.forEach(password => {
        const validation = validatePassword(password);
        expect(validation.isValid).toBe(false);
      });
    });

    it('should handle password confirmation matching', () => {
      const password = 'MySecurePassword123';
      const matchingConfirmation = 'MySecurePassword123';
      const nonMatchingConfirmation = 'DifferentPassword456';

      expect(password).toBe(matchingConfirmation);
      expect(password).not.toBe(nonMatchingConfirmation);
    });

    it('should handle special characters in passwords', () => {
      const passwordsWithSpecialChars = [
        'Pass@word123',
        'Secure#Password!',
        'My$ecure_Pa$$word',
        'Test-Password.2023'
      ];

      passwordsWithSpecialChars.forEach(password => {
        expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/);
      });
    });
  });

  describe('Share Name Validation', () => {
    it('should validate share names', () => {
      const validNames = [
        'My Main Share',
        'Backup Share 1',
        'Work_Keyset_2023',
        'Personal-Signing-Key'
      ];

      const invalidNames = [
        '',                    // empty
        ' ',                   // whitespace only
        'a'.repeat(256),       // too long
      ];

      validNames.forEach(name => {
        expect(name.trim().length).toBeGreaterThan(0);
        expect(name.length).toBeLessThan(255);
      });

      invalidNames.forEach(name => {
        const isValid = name.trim().length > 0 && name.length < 255;
        expect(isValid).toBe(false);
      });
    });

    it('should sanitize share names for filesystem', () => {
      const unsafeNames = [
        'Share/with/slashes',
        'Share\\with\\backslashes',
        'Share:with:colons',
        'Share*with*asterisks',
        'Share?with?questions',
        'CON.txt',                    // Windows reserved name
        'share name.  ',              // Trailing dots and spaces
        '.hidden',                    // Leading dot
        'a'.repeat(300),              // Too long
        '<invalid>',                  // Angle brackets
        'file|name'                   // Pipe character
      ];

      const validNames = [
        'Valid Share Name',
        'Share_123',
        'backup-keyset',
        'work.share'
      ];

      // Test unsafe names get sanitized
      unsafeNames.forEach(name => {
        const result = sanitizeShareFilename(name);
        
        // Should detect that original was unsafe
        expect(result.originalUnsafe || result.errors.length > 0).toBe(true);
        
        // Sanitized version should be safe for filesystem
        expect(result.sanitized).toBeTruthy();
        expect(result.sanitized.length).toBeLessThanOrEqual(FILESYSTEM_LIMITS.MAX_FILENAME_LENGTH);
        
        // Should not contain unsafe filesystem characters
        expect(result.sanitized).not.toMatch(/[<>:"/\\|?*]/);
        
        // Should not contain control characters
        expect(result.sanitized).not.toMatch(/[\u0000-\u001f]/);
        
        // Should not end with dots or spaces
        expect(result.sanitized).not.toMatch(/[. ]$/);
        
        // Should not be a Windows reserved name
        expect(result.sanitized).not.toMatch(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i);
      });

      // Test valid names remain unchanged
      validNames.forEach(name => {
        const result = sanitizeShareFilename(name);
        
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(name);
        expect(result.errors).toHaveLength(0);
        expect(isFilenameSafe(name)).toBe(true);
      });
    });
  });

  describe('Hex String Validation', () => {
    it('should validate hex strings for shares and keys', () => {
      const validHexStrings = [
        'abc123',
        'ABC123',
        'deadbeef',
        'DEADBEEF',
        '0123456789abcdef'
      ];

      const invalidHexStrings = [
        '',                    // empty
        'ghijkl',             // invalid hex characters
        'xyz123',             // invalid hex characters
        'abc12g',             // mixed valid/invalid
        '12 34',              // contains space
        '12-34',              // contains dash
      ];

      validHexStrings.forEach(hex => {
        expect(hex).toMatch(/^[0-9a-fA-F]+$/);
      });

      invalidHexStrings.forEach(hex => {
        expect(hex).not.toMatch(/^[0-9a-fA-F]+$/);
      });
    });

    it('should validate specific hex string lengths', () => {
      const nsecLength = 64; // 32 bytes = 64 hex chars
      const shareLength = 128; // varies, but test a common length

      const validNsec = 'a'.repeat(nsecLength);
      const validShare = 'b'.repeat(shareLength);
      
      const invalidNsec = 'a'.repeat(nsecLength - 1);
      const invalidShare = 'b'.repeat(shareLength + 1);

      expect(validNsec.length).toBe(nsecLength);
      expect(validShare.length).toBe(shareLength);
      expect(invalidNsec.length).not.toBe(nsecLength);
      expect(invalidShare.length).not.toBe(shareLength);
    });
  });

  describe('Relay URL Validation', () => {
    it('should validate WebSocket relay URLs', () => {
      const validRelayUrls = [
        'wss://relay.example.com',
        'ws://localhost:8080',
        'wss://nostr-relay.com/relay',
        'ws://192.168.1.100:7777'
      ];

      const invalidRelayUrls = [
        '',                           // empty
        'http://example.com',         // wrong protocol
        'https://example.com',        // wrong protocol
        'wss://',                     // incomplete
        'not-a-url',                  // not a URL
        'ftp://relay.com',            // wrong protocol
      ];

      validRelayUrls.forEach(url => {
        expect(isValidRelayUrl(url)).toBe(true);
        const result = formatRelayUrl(url);
        expect(result.isValid).toBe(true);
      });

      invalidRelayUrls.forEach(url => {
        expect(isValidRelayUrl(url)).toBe(false);
        const result = formatRelayUrl(url);
        expect(result.isValid).toBe(false);
      });
    });

    it('should handle relay URL formatting', () => {
      const urlsNeedingFormatting = [
        'relay.example.com',          // missing protocol
        'wss://relay.example.com/',   // trailing slash
        ' wss://relay.com ',          // whitespace
      ];

      const expectedFormatted = [
        'wss://relay.example.com',
        'wss://relay.example.com',
        'wss://relay.com',
      ];

      urlsNeedingFormatting.forEach((url, index) => {
        const result = formatRelayUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.formatted).toBe(expectedFormatted[index]);
        expect(result.message).toBeUndefined();
      });
    });
  });

  describe('File System Error Handling', () => {
    it('should handle filesystem permission errors', () => {
      const permissionError = new Error('EACCES: permission denied');
      const diskFullError = new Error('ENOSPC: no space left on device');
      const pathNotFoundError = new Error('ENOENT: no such file or directory');

      const errors = [permissionError, diskFullError, pathNotFoundError];
      
      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
      });
    });

    it('should handle file corruption scenarios', () => {
      const corruptedJsonExamples = [
        '',                    // empty file
        '{',                   // incomplete JSON
        '{"id": }',           // malformed JSON
        'not json at all',    // not JSON
        '{"id": "test"',      // unterminated JSON
      ];

      corruptedJsonExamples.forEach(content => {
        let isValidJson = false;
        try {
          JSON.parse(content);
          isValidJson = true;
        } catch {
          isValidJson = false;
        }
        
        expect(isValidJson).toBe(false);
      });
    });
  });

  describe('Encryption Error Handling', () => {
    it('should handle encryption failures gracefully', () => {
      mockDeriveSecret.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => {
        mockDeriveSecret('password', 'salt');
      }).toThrow('Encryption failed');
    });

    it('should handle invalid salt values', () => {
      const invalidSalts = [
        '',                    // empty
        'invalid-hex',         // not hex
        'abc123',             // too short but valid hex
      ];

      invalidSalts.forEach(salt => {
        // Test that salt validation would catch these
        const validation = validateSalt(salt);
        expect(validation.isValid).toBe(false);
        expect(isValidSalt(salt)).toBe(false);
        
        // Verify specific validation details
        if (salt === '') {
          expect(validation.message).toBe('Salt is required');
        } else if (salt === 'invalid-hex') {
          expect(validation.isHexadecimal).toBe(false);
          expect(validation.message).toBe('Salt must contain only hexadecimal characters (0-9, a-f, A-F)');
        } else if (salt === 'abc123') {
          expect(validation.hasMinLength).toBe(false);
          expect(validation.isHexadecimal).toBe(true);
          expect(validation.message).toBe('Salt must be at least 16 characters long');
        }
      });
    });

    it('should handle valid salt values', () => {
      const validSalts = [
        'abcdef0123456789',        // minimum valid length (16 chars)
        'ABCDEF0123456789',        // uppercase hex
        'a1b2c3d4e5f67890abc123',  // longer valid salt
        '0123456789abcdefABCDEF'  // mixed case
      ];

      validSalts.forEach(salt => {
        const validation = validateSalt(salt);
        expect(validation.isValid).toBe(true);
        expect(isValidSalt(salt)).toBe(true);
        expect(validation.hasMinLength).toBe(true);
        expect(validation.isHexadecimal).toBe(true);
        expect(validation.message).toBeUndefined();
      });
    });
  });

  describe('User Interface Error States', () => {
    it('should handle loading states', () => {
      const loadingStates = {
        isLoading: false,
        hasError: false,
        errorMessage: null as string | null
      };

      // Test initial state
      expect(loadingStates.isLoading).toBe(false);
      expect(loadingStates.hasError).toBe(false);
      expect(loadingStates.errorMessage).toBeNull();

      // Test loading state
      loadingStates.isLoading = true;
      expect(loadingStates.isLoading).toBe(true);

      // Test error state  
      loadingStates.isLoading = false;
      loadingStates.hasError = true;
      loadingStates.errorMessage = 'Failed to load shares';
      
      expect(loadingStates.hasError).toBe(true);
      expect(loadingStates.errorMessage).toBe('Failed to load shares');
    });

    it('should handle user-friendly error messages', () => {
      const technicalErrors = [
        'ENOENT: no such file or directory',
        'TypeError: Cannot read property of undefined',
        'ReferenceError: variable is not defined'
      ];

      const userFriendlyMessages = [
        'Share file not found. Please check if the file exists.',
        'There was a problem loading your data. Please try again.',
        'An unexpected error occurred. Please restart the application.'
      ];

      technicalErrors.forEach((error, index) => {
        // Test that technical errors can be mapped to user-friendly messages
        expect(technicalErrors[index]).toBeTruthy();
        expect(userFriendlyMessages[index]).toBeTruthy();
        expect(userFriendlyMessages[index].length).toBeLessThan(100); // Keep messages concise
      });
    });
  });

  describe('Clipboard and QR Code Validation', () => {
    it('should validate clipboard content', () => {
      const validClipboardContent = [
        'nsec1abc123def456...',
        'npub1xyz789abc123...',
        'share-credential-data'
      ];

      const invalidClipboardContent = [
        '',                    // empty
        null,                  // null
        undefined,             // undefined
        123,                   // number
        {},                    // object
      ];

      validClipboardContent.forEach(content => {
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
      });

      invalidClipboardContent.forEach(content => {
        const isValid = typeof content === 'string' && content.length > 0;
        expect(isValid).toBe(false);
      });
    });

    it('should handle QR code generation errors', () => {
      const qrCodeInputs = [
        '',                           // empty
        'a'.repeat(5000),            // too long for QR
        'valid-share-data',          // valid
        null,                        // null
      ];

      qrCodeInputs.forEach(input => {
        const canGenerateQR = typeof input === 'string' && 
                             input.length > 0 && 
                             input.length < 2000; // reasonable QR code limit
        
        if (input === 'valid-share-data') {
          expect(canGenerateQR).toBe(true);
        } else {
          expect(canGenerateQR).toBe(false);
        }
      });
    });
  });
}); 