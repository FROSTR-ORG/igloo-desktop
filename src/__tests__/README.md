# Igloo Test Suite

This directory contains the tests for the Igloo application, which focuses on key management and signing using the FROSTR protocol. Our testing approach emphasizes thorough test coverage, realistic mocking, and clear organization.

## Testing Strategy

1. **Unit Tests**: Testing individual functions and components in isolation
2. **Component Tests**: Testing UI components (to be added)
3. **Integration Tests**: Testing workflows across multiple components (to be added)

## Best Practices

We follow these best practices for our tests:

1. **Focus on Behavior, Not Implementation**: Tests verify what a function does, not how it does it
2. **Minimize Mock Verification**: Avoid excessive assertions about mock calls which make tests brittle
3. **Realistic Mocks**: Create mocks that simulate real behavior when needed
4. **Type Safety**: Use TypeScript interfaces to maintain type checking in mocks
5. **Clear Organization**: Group related tests with descriptive `describe` and `it` blocks
6. **Independent Tests**: Each test should be independent and not rely on state from other tests
7. **Clean Setup/Teardown**: Reset mocks between tests to prevent test pollution
8. **Meaningful Assertions**: Verify the structure and values of outputs, not internal mechanics
9. **Centralized Mocks**: Reuse common mocks across test files to maintain consistency

## Directory Structure

```
__tests__/               # Main testing directory
├── __mocks__/           # Shared mock implementations 
│   └── buff.mock.ts     # Mock implementation of Buff library
├── mocks/               # Additional mock implementations
├── bifrost.test.ts      # Tests for Bifrost functionality
├── buff.test.ts         # Tests for Buff mock implementation
├── encryption.test.ts   # Tests for encryption utilities
├── validation.test.ts   # Tests for validation functions
└── README.md            # This file
```

## Recent Improvements

We've made several improvements to the test suite:

1. **Centralized Mocking**: Moved the `Buff` mock implementation to a shared file that can be used consistently across all tests
2. **Reduced Implementation Testing**: Refactored tests to focus on behavior rather than implementation details
3. **Improved Test Isolation**: Tests no longer rely on specific implementation details of mocks
4. **Simplified Error Tests**: Consolidated similar error handling tests to reduce verbosity
5. **Better Test Structure**: Tests now follow a clear pattern of "Given-When-Then" arrangement
6. **Mock Verification**: Reduced explicit verification of mock calls to make tests less brittle
7. **Realistic Testing**: Added tests that better represent real-world usage patterns

## Current Test Coverage

Our current test suite covers:

- **Validation**: Input validation for various formats (nsec, hex privkey, share, group, relay)
- **Encryption**: Secret derivation, encryption, and decryption operations
- **Bifrost**: Key management, share generation, and secret recovery
- **Buff**: Mock behavior validation for the Buff utility library

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

1. **Shared Mocks**: Use shared mock implementations for common dependencies
2. **Behavior Simulation**: Mock behavior rather than implementation details
3. **Avoid Over-Mocking**: Only mock what's necessary for the test
4. **Encapsulation**: Keep mock implementation details hidden from tests

## Handling External Dependencies

We've implemented special handling for ESM modules like `@frostr/bifrost` and `@cmdcode/buff`:

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
6. Focus on behavior, not implementation details
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