# Igloo Test Suite

This directory contains the tests for the Igloo application. The testing approach follows these principles:

## Testing Strategy

1. **Unit Tests**: Testing individual functions and components in isolation
2. **Component Tests**: Testing UI components (to be added)
3. **Integration Tests**: Testing workflows across multiple components (to be added)

## Directory Structure

```
__tests__/               # Main testing directory
├── mocks/               # Mock implementations for dependencies
│   ├── bifrost.mock.ts  # Bifrost library mocks
│   └── nostr-tools.mock.ts # Nostr-tools mocks
├── bifrost.test.ts      # Tests for Bifrost functionality
├── encryption.test.ts   # Tests for encryption utilities
├── validation.test.ts   # Tests for validation functions
└── README.md            # This file
```

## Current Test Coverage

- **Validation**: Tests for input validation functions (nsec, hex privkey, share, group, relay)
- **Encryption**: Tests for the encryption and decryption utilities 
- **Bifrost**: Tests for the Bifrost integration and key management functions

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

We use Jest's mocking capabilities to:

1. Mock external dependencies like `nostr-tools` and `@frostr/bifrost`
2. Provide predictable test data 
3. Isolate tests from network requests and other side effects

All mocks are centralized in the `__tests__/mocks` directory and imported where needed. This keeps the mocks organized, reusable, and makes them easy to maintain.

## Future Improvements

1. Add UI component testing with React Testing Library
2. Add E2E tests for complete workflows
3. Implement test coverage requirements
4. Add snapshot testing for UI components

## Adding New Tests

When adding new tests:

1. Follow the naming convention: `*.test.ts` or `*.test.tsx`
2. Group related tests with `describe` blocks
3. Use clear test descriptions with `it` statements
4. If you need mocks, use or add to the existing ones in the `mocks` directory
5. Focus on behavior, not implementation details

## Configuration

See `jest.config.js` in the project root for test configuration. We use:

- TypeScript support via `ts-jest`
- Custom transformation patterns for node modules that use ESM 
- Standard test matching patterns 