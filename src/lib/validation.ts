import React from 'react';
import {
  validateNsec,
  validateHexPrivkey,
  validateShare,
  validateGroup,
  validateRelay,
  validateBfcred,
  type ValidationResult
} from '@igloo/core';

// Re-export all validation functions from igloo/core
export {
  validateNsec,
  validateHexPrivkey,
  validateShare,
  validateGroup,
  validateRelay,
  validateBfcred
};

// Re-export types
export type { ValidationResult };

/**
 * A reusable form input component factory with validation
 * @param value The current value
 * @param validator The validation function to use
 * @returns An object with validation state and handler
 */
export function useFormInput<T>(
  initialValue: string,
  validator: (value: string) => ValidationResult
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