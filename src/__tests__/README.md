# Igloo Test Suite

This directory contains the tests for the Igloo application, which focuses on key management and signing using the FROSTR protocol. Our testing approach emphasizes thorough test coverage, realistic mocking, and clear organization.

## Testing Strategy

Since migrating core logic to `@frostr/igloo-core`, our testing focuses on **desktop-specific functionality**:

1. **Desktop Integration Tests**: Electron IPC, file system operations, share management
2. **React Component Tests**: UI behavior, user interactions, state management  
3. **Workflow Tests**: End-to-end user workflows across components
4. **Desktop-Specific Features**: Clipboard, file explorer integration, QR codes

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
__tests__/                    # Main testing directory
├── __mocks__/                # Shared mock implementations 
│   ├── buff.mock.ts          # Mock implementation of Buff library
│   ├── nostr-tools.mock.ts   # Mock for nostr-tools
│   └── bifrost.mock.ts       # Legacy bifrost mocks (to be cleaned up)
├── integration/              # Desktop integration tests
│   ├── clientShareManager.test.ts  # Electron IPC communication
│   └── shareManager.test.ts        # File system operations (planned)
├── components/               # React component tests
│   ├── Signer.test.tsx       # Signer component UI and igloo-core integration
│   ├── App.test.tsx          # App routing and state (planned)
│   └── ...                   # Other component tests (planned)
├── workflows/                # End-to-end workflow tests
│   └── share-lifecycle.test.ts    # Complete share workflow
├── encryption.test.ts        # Desktop encryption utilities
├── buff.test.ts             # Buff mock implementation tests
└── README.md                # This file
```

## Current Test Coverage

Our current test suite covers **desktop-specific functionality**:

- **Desktop Integration**: Electron IPC communication, file system operations
- **Component Testing**: React component UI, user interactions, state management
- **Workflow Testing**: End-to-end user workflows (create → save → load → use)
- **Desktop Features**: Clipboard integration, file explorer operations
- **Encryption**: Desktop-specific encryption utilities (password derivation, file encryption)

**Core Logic**: Validation, key management, and cryptographic operations are tested in `@frostr/igloo-core`

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

## Recent Improvements

We've made several improvements to the test suite:

1. **Centralized Mocking**: Moved the `Buff` mock implementation to a shared file that can be used consistently across all tests
2. **Consolidated Bifrost Mocks**: Unified all Bifrost mocks into a single source of truth (`bifrost.mock.ts`) to eliminate duplication while maintaining backward compatibility
3. **Reduced Implementation Testing**: Refactored tests to focus on behavior rather than implementation details
4. **Improved Test Isolation**: Tests no longer rely on specific implementation details of mocks
5. **Simplified Error Tests**: Consolidated similar error handling tests to reduce verbosity
6. **Better Test Structure**: Tests now follow a clear pattern of "Given-When-Then" arrangement
7. **Mock Verification**: Reduced explicit verification of mock calls to make tests less brittle
8. **Realistic Testing**: Added tests that better represent real-world usage patterns

## Configuration

See `jest.config.js`