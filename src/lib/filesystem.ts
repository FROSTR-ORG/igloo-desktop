import sanitizeFilename from 'sanitize-filename';

export interface FilenameSanitizationResult {
  sanitized: string;
  isValid: boolean;
  originalUnsafe: boolean;
  errors: string[];
}

/**
 * Sanitizes a filename for cross-platform filesystem compatibility
 * @param filename - The filename to sanitize
 * @param options - Additional sanitization options
 * @returns FilenameSanitizationResult with sanitized filename and validation info
 */
export function sanitizeShareFilename(
  filename: string,
  options: { replacement?: string; maxLength?: number } = {}
): FilenameSanitizationResult {
  const { replacement = '_', maxLength = 255 } = options;
  const originalFilename = filename;
  const errors: string[] = [];
  
  // Check if original filename has unsafe characters
  const originalUnsafe = hasUnsafeCharacters(filename);
  
  // Check original filename for OS-specific issues before sanitization
  const originalOSErrors = validateOSSpecificRules(filename);
  
  // Check if filename is too long originally
  if (filename.length > maxLength) {
    errors.push(`Filename truncated to ${maxLength} characters`);
  }
  
  // Use the sanitize-filename library for cross-platform sanitization
  let sanitized = sanitizeFilename(filename, { replacement });
  
  // Additional validations and fixes
  if (!sanitized || sanitized.trim().length === 0) {
    sanitized = 'untitled';
    errors.push('Empty or invalid filename, using default name');
  }
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Check length after sanitization
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Add original OS-specific errors to the list
  errors.push(...originalOSErrors);
  
  // Apply additional fixes for OS-specific issues
  if (originalOSErrors.length > 0) {
    sanitized = applyOSSpecificFixes(sanitized, replacement);
  }
  
  // Check if the sanitized version is different from original
  const wasChanged = filename !== sanitized;
  
  const isValid = errors.length === 0 && !wasChanged;
  
  return {
    sanitized,
    isValid,
    originalUnsafe: originalUnsafe || originalOSErrors.length > 0 || wasChanged,
    errors
  };
}

/**
 * Checks if a filename contains unsafe characters
 */
function hasUnsafeCharacters(filename: string): boolean {
  // Characters that are unsafe across most filesystems
  const unsafeChars = /[<>:"/\\|?*\x00-\x1f]/;
  return unsafeChars.test(filename);
}

/**
 * Validates OS-specific filename rules
 */
function validateOSSpecificRules(filename: string): string[] {
  const errors: string[] = [];
  
  // Windows reserved names
  const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (windowsReserved.test(filename)) {
    errors.push('Filename uses Windows reserved name');
  }
  
  // Names ending with dot or space (problematic on Windows)
  if (filename.endsWith('.') || filename.endsWith(' ')) {
    errors.push('Filename ends with dot or space (Windows incompatible)');
  }
  
  // Names starting with dot (hidden files on Unix-like systems)
  if (filename.startsWith('.')) {
    errors.push('Filename starts with dot (will be hidden on Unix-like systems)');
  }
  
  return errors;
}

/**
 * Applies additional OS-specific fixes
 */
function applyOSSpecificFixes(filename: string, replacement: string): string {
  let fixed = filename;
  
  // Remove trailing dots and spaces
  fixed = fixed.replace(/[. ]+$/, '');
  
  // Handle Windows reserved names by appending underscore
  const windowsReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (windowsReserved.test(fixed)) {
    fixed = fixed + replacement;
  }
  
  // Ensure we don't end up with empty string
  if (!fixed || fixed.trim().length === 0) {
    fixed = 'file';
  }
  
  return fixed;
}

/**
 * Validates if a filename is safe for the current platform
 * @param filename - The filename to validate
 * @returns boolean indicating if the filename is safe
 */
export function isFilenameSafe(filename: string): boolean {
  const result = sanitizeShareFilename(filename);
  return result.isValid && filename === result.sanitized;
}

/**
 * Common filesystem path length limits
 */
export const FILESYSTEM_LIMITS = {
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 4096,
  WINDOWS_MAX_PATH: 260,
} as const; 