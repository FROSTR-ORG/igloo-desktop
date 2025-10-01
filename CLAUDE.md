# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Igloo is a desktop key management and remote signing application for the FROSTR protocol, which implements k-of-n threshold signatures using FROST (Flexible Round-Optimized Schnorr Threshold signatures) for nostr. Built with Electron, React, and TypeScript.

**Architecture**: Igloo uses a hybrid architecture where the desktop app handles UI/UX and file management while `@frostr/igloo-core` (external library) handles all cryptographic operations, validation, and node management.

## Development Commands

### Essential Commands
```bash
npm install              # Install dependencies
npm run dev             # Start webpack watch + Electron with hot reload
npm start               # Build once, then launch Electron
npm run build           # Compile TypeScript and bundle to dist/
npm run watch           # TypeScript watch mode only
```

### Testing
```bash
npm test                # Run full Jest test suite
npm run test:watch      # Jest watch mode for development
npm test -- <file>      # Run specific test file
npm test -- --coverage  # Generate coverage report
```

### Linting
```bash
npm run lint            # Auto-fix linting issues
npm run lint:check      # Check without fixing
```

### Distribution
```bash
npm run dist            # Build for current platform
npm run dist:mac        # macOS signed & notarized build
npm run dist:mac-unsigned  # macOS unsigned (dev only)
npm run dist:win        # Windows build
npm run dist:linux      # Linux AppImage and .deb
```

### Release Process
```bash
./scripts/release.sh X.Y.Z   # Create GPG-signed git tag with version bump
git push origin main && git push origin vX.Y.Z  # Trigger CI release workflow
```

## Architecture

### Core Concepts

**Shares**: FROST protocol splits a nostr nsec (private key) into multiple shares using Shamir Secret Sharing. Individual shares are useless; threshold number of shares can reconstruct the key or create valid signatures.

**Keysets**: A collection of shares that work together, identified by a unique group key. Shares from different keysets cannot be mixed.

**Remote Signing**: Signing nodes communicate over nostr relays with end-to-end encryption to coordinate threshold signatures without reconstructing the full key.

### Project Structure

```
src/
├── main.ts                    # Electron main process, IPC handlers
├── renderer.tsx               # React app entry point
├── components/
│   ├── App.tsx               # Main routing and app state
│   ├── Create.tsx            # Generate or import keyset
│   ├── Keyset.tsx            # Display shares, QR codes
│   ├── SaveShare.tsx         # Password-encrypt and save shares
│   ├── ShareList.tsx         # Detect and list saved shares
│   ├── LoadShare.tsx         # Decrypt and load share into memory
│   ├── Signer.tsx            # Start signing node, handle requests
│   ├── EventLog.tsx          # Display signing events
│   ├── Recover.tsx           # Reconstruct nsec from threshold shares
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── shareManager.ts       # File system share operations (main process)
│   ├── clientShareManager.ts # IPC wrapper for renderer (calls shareManager)
│   ├── encryption.ts         # PBKDF2 password derivation for share files
│   ├── filesystem.ts         # Electron app data path utilities
│   ├── validation.ts         # Input validation helpers
│   └── utils.ts              # General utilities, cn() for Tailwind
├── types/
│   └── index.ts              # Shared TypeScript types
└── __tests__/
    ├── setup.ts              # Jest config, global mocks
    ├── __mocks__/            # Shared mock implementations
    ├── integration/          # Electron IPC, file system tests
    ├── workflows/            # End-to-end user flow tests
    ├── components/           # React component tests
    └── lib/                  # Library unit tests
```

### Electron Architecture

**Main Process** (`src/main.ts`):
- Creates BrowserWindow
- Registers IPC handlers for share operations
- Instantiates `ShareManager` for file system access
- Shares stored in `<appData>/igloo/shares/*.json`

**Renderer Process** (`src/renderer.tsx`, components):
- React UI with no direct file system access
- Calls `ClientShareManager` which uses `ipcRenderer.invoke()`
- All cryptographic operations delegate to `@frostr/igloo-core`

### Key IPC Channels
- `get-shares`: List all saved shares
- `save-share`: Encrypt and write share to file system
- `delete-share`: Remove share file
- `open-share-location`: Open Finder/Explorer at share location

### State Management

App-level state in `App.tsx` tracks:
- `currentView`: Which screen is active
- `keyset`: Temporary in-memory keyset (cleared after saving shares)
- `loadedShare`: Currently decrypted share for signing
- `shares`: List of available shares from file system

Components communicate via props and callbacks; no Redux or external state library.

### Cryptographic Operations (via @frostr/igloo-core)

All crypto operations are handled by the external library:
- `generateKeysetWithSecret()`: Create keyset from nsec
- `validateShare()`, `validateGroup()`: Input validation
- `decodeShare()`, `decodeGroup()`: Parse encoded credentials
- `createConnectedNode()`: Initialize signing node
- `recoverSecretKeyFromCredentials()`: Reconstruct nsec from threshold shares
- `cleanupBifrostNode()`: Properly disconnect signing node

**Do not implement cryptographic logic in the desktop app**—always use `@frostr/igloo-core`.

### File Storage

Shares are stored as encrypted JSON in `<appData>/igloo/shares/`:
```json
{
  "id": "unique-id",
  "name": "Share 1",
  "share": "encrypted-share-data",
  "salt": "hex-salt",
  "groupCredential": "group-key",
  "savedAt": "ISO-timestamp",
  "metadata": {
    "binder_sn": "8-char-prefix"
  }
}
```

Encryption: PBKDF2 with 100,000 iterations, user-provided password, random salt.

## Testing Strategy

Tests focus on **desktop-specific functionality**:
- Electron IPC communication
- File system operations
- React component behavior
- User workflows across components
- Desktop features (clipboard, QR codes, file explorer)

**Core cryptographic logic is tested in `@frostr/igloo-core`**, not here.

### Test Organization
- `__tests__/integration/`: IPC and file system
- `__tests__/workflows/`: End-to-end user flows
- `__tests__/components/`: React component tests
- `__tests__/lib/`: Utility unit tests
- `__tests__/__mocks__/`: Shared mocks for external dependencies

### Writing Tests
- Mock `@frostr/igloo-core` functions at the module level (see `setup.ts`)
- Mock Electron's `ipcRenderer` and `app` APIs
- Test both success and error paths
- Use `jest.clearAllMocks()` in `beforeEach`
- Focus on behavior, not implementation details

## Code Style

### TypeScript
- Strict mode enabled
- Use explicit types for function parameters and returns
- Prefer interfaces over types for object shapes
- Use `@/` path alias for imports: `import { foo } from '@/lib/utils'`

### React
- Functional components with hooks
- PascalCase for component files: `SaveShare.tsx`
- camelCase for functions and variables
- kebab-case for non-component files under `components/ui/`

### Naming Conventions
- Components: `PascalCase` (SaveShare, ClientShareManager)
- Functions: `camelCase` (saveShare, validateRelay)
- Constants: `UPPER_SNAKE_CASE` (DEBUG_GROUP_AUTO)
- Files: `kebab-case` for utilities, `PascalCase` for components

### Styling
- Tailwind CSS utility classes in JSX
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Avoid inline styles unless conditionally computed
- shadcn/ui components in `components/ui/`

### Linting
- ESLint with TypeScript, React, and React Hooks rules
- Run `npm run lint` before committing
- Address warnings; don't suppress unless necessary

## Build and Release

### macOS Signing
- Production releases are **code-signed with Apple Developer ID** and **notarized**
- Requires environment variables: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- See [MAC_SIGNING_SETUP.md](MAC_SIGNING_SETUP.md) for detailed setup
- Development builds: use `npm run dist:mac-unsigned`

### Dual-Layer Security
All releases include:
1. **GPG signing**: Git tags and release artifacts signed with developer PGP key
2. **macOS code signing**: macOS apps signed with Apple Developer ID and notarized

### Release Workflow
1. `./scripts/release.sh X.Y.Z` updates `package.json` and creates GPG-signed git tag
2. Push tag to trigger GitHub Actions CI
3. CI builds for all platforms, signs artifacts, generates checksums
4. Automated release creation with signed binaries

### Build Outputs
- **Windows**: `.exe` installer and portable
- **macOS**: `.dmg` and `.zip` for Intel (x64) and Apple Silicon (arm64)
- **Linux**: `.AppImage` and `.deb`

## Common Workflows

### Adding a New Component
1. Create `src/components/MyComponent.tsx`
2. Import into `App.tsx` and add to routing logic
3. Add IPC handlers in `main.ts` if file system access needed
4. Add tests in `src/__tests__/components/MyComponent.test.tsx`

### Adding a New IPC Handler
1. Register handler in `main.ts`: `ipcMain.handle('my-channel', async (_, args) => { ... })`
2. Add method to `ClientShareManager` or create new client class
3. Use `ipcRenderer.invoke('my-channel', args)` in renderer
4. Add integration test in `__tests__/integration/`

### Adding Cryptographic Functionality
**Don't**. Coordinate with `@frostr/igloo-core` maintainers to add features to the core library, then import and use them.

### Debugging
- Development mode opens DevTools automatically
- Use `console.log` in both main and renderer processes
- Main process logs appear in terminal; renderer logs in DevTools
- Set `DEBUG_GROUP_AUTO = true` in relevant files for verbose logging

## Dependencies

### Key Libraries
- `electron`: Desktop app framework
- `react` + `react-dom`: UI library (v17)
- `@frostr/igloo-core`: Core cryptographic operations
- `@frostr/bifrost`: Nostr relay communication
- `@noble/hashes`, `@noble/curves`, `@noble/ciphers`: Crypto primitives
- `@radix-ui/*`: Accessible UI primitives
- `tailwindcss`: Utility-first CSS
- `zod`: Schema validation

### Dev Dependencies
- `typescript`: Language
- `webpack`: Bundler for renderer process
- `electron-builder`: Packaging and distribution
- `jest` + `ts-jest`: Testing framework
- `@testing-library/react`: React testing utilities
- `eslint`: Linting

## Important Notes

### Security
- Never commit sensitive keys, tokens, or passwords
- Shares are encrypted with user passwords; never store plaintext
- All signing communication uses end-to-end encryption via bifrost
- GPG keys and Apple Developer certificates stored in GitHub Secrets

### Platform Compatibility
- macOS: Requires proper code signing and notarization (no ad-hoc signing)
- Windows: NSIS installer or portable executable
- Linux: AppImage (universal) or .deb (Debian/Ubuntu)

### Core Library Dependency
Desktop app should remain thin—delegate crypto operations to `@frostr/igloo-core`. If you need to add validation, node management, or key operations, check if `@frostr/igloo-core` already provides it or should be extended.

### Known Quirks
- Electron's main process uses CommonJS (`require`), renderer uses ESM (`import`)
- `@frostr/igloo-core` is mocked in tests to avoid ESM/Jest complications
- macOS notarization happens post-build via `scripts/notarize.js`
- Version must match between `package.json` and git tag or CI will fail