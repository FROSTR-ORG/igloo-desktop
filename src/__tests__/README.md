# Igloo Test Suite

This directory contains the tests for the Igloo application, which focuses on key management and signing using the FROSTR protocol. Our testing approach emphasizes thorough test coverage, realistic mocking, and clear organization.

## Testing Strategy

1. **Unit Tests**: Testing individual functions and components in isolation
2. **Component Tests**: Testing UI components (to be added)
3. **Integration Tests**: Testing workflows across multiple components (to be added)

## Best Practices

We follow these best practices for our tests:

1. **Complete Test Coverage**: Test both success cases and error conditions
2. **Realistic Mocks**: Create mocks that simulate real behavior, not just return fixed values
3. **Type Safety**: Use TypeScript interfaces to maintain type checking in mocks
4. **Clear Organization**: Group related tests with descriptive `describe` and `it` blocks
5. **Independent Tests**: Each test should be independent and not rely on state from other tests
6. **Clean Setup/Teardown**: Reset mocks between tests to prevent test pollution
7. **Meaningful Assertions**: Verify both the structure and values of test results
8. **Documentation**: Include clear comments explaining the testing approach

## Directory Structure

```
__tests__/               # Main testing directory
├── mocks/               # Mock implementations for dependencies
│   └── .gitkeep         # Empty file to ensure directory is versioned
├── bifrost.test.ts      # Tests for Bifrost functionality
├── encryption.test.ts   # Tests for encryption utilities
├── validation.test.ts   # Tests for validation functions
└── README.md            # This file
```

## Current Test Coverage

Our current test suite covers:

- **Validation**: Input validation for various formats (nsec, hex privkey, share, group, relay)
- **Encryption**: Secret derivation, encryption, and decryption operations
- **Bifrost**: Key management, share generation, and secret recovery

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage

# Run tests in watch mode (useful during development)
npm run test:watch

# Run specific test file
npm test -- encryption.test.ts
```

## Mock Strategy

Our approach to mocking:

1. **Inline Mocking**: Mock dependencies directly in test files using `jest.mock()`
2. **Realistic Behavior**: Mocks return different values based on inputs
3. **Spy Functions**: Track function calls and parameters for verification
4. **Error Simulation**: Mocks can throw errors to test error handling
5. **State Management**: Use `beforeEach` to reset mocks between tests

## Handling External Dependencies

We've implemented special handling for ESM modules like `@frostr/bifrost`:

1. **Direct Mocking**: We fully mock the interfaces we need, avoiding actual imports
2. **Interface Definitions**: We define TypeScript interfaces to maintain type safety
3. **Jest Configuration**: We've configured Jest to handle ESM modules with custom transformers

## Adding New Tests

When adding new tests:

1. Follow the naming convention: `*.test.ts` or `*.test.tsx`
2. Group related tests with `describe` blocks
3. Use clear test descriptions with `it` statements
4. Reset mocks in `beforeEach` blocks
5. Test both success cases and error conditions
6. Verify function calls and parameters with `expect().toHaveBeenCalledWith()`
7. Include edge cases and input validation tests

## Future Improvements

1. Add UI component testing with React Testing Library
2. Add E2E tests for complete workflows
3. Implement test coverage requirements and reports
4. Add snapshot testing for UI components
5. Implement integration tests for cross-component interaction

## Configuration

See `jest.config.js` in the project root for test configuration. We use:

- TypeScript support via `ts-jest`
- Custom transformation patterns for node modules that use ESM 
- Standard test matching patterns 