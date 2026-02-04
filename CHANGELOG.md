# Changelog

## 1.0.3 - 2026-02-04

### Added
- New AddShare flow for importing shares, including relay-plan request via `window.electronAPI.computeRelayPlan`.
- New Onboarding screen and updated app state flow for onboarding plus share-loaded tracking.
- Relay planner and types, including `computeRelayPlan`, relay normalization/dedupe/priority merge, and exported `RelayPlan`.
- Typed preload API and IPC surface, including contextBridge `ElectronAPI`, window typing, and a dedicated preload tsconfig.
- New signer keep-alive module to improve long-running signer behavior.

### Changed
- Refactored renderer to use the preload bridge (`window.electronAPI`) instead of direct `ipcRenderer` usage.
- Improved echo/relay wiring in the main process with new handlers for relay-plan plus echo start/stop, multi-target listener wiring, and stricter window guards.
- Recovery UX now masks NSEC with reveal/copy/auto-clear behavior and timeout cleanup.
- Build/bundler pipeline updated to compile preload with webpack and electron-builder adjustments, including buffer/ProvidePlugin, fallbacks, and TS build configs.

### Security
- IPC input validation using Zod schemas, expanded IPC schemas, and safer invoke/handler patterns.
- Electron hardening with context isolation and preload, CSP meta tag, and navigation/windowOpen handling patterns tested.
- SSRF-aware relay validation with sanitized user-facing errors.
- Stricter share save permissions with restrictive directory/file modes and Windows ACL notes.
- Save callback no longer receives passwords; SaveShare signature updated to `(salt, encryptedShare)`.

### Fixed
- Reduced race conditions and improved mount/unmount safety plus echo listener cleanup.
- LoadShare legacy length sanity checks and better sanitized decode/load errors.

### Tests
- Major expansion of unit/integration/security tests and centralized electron API mocking; ~445 tests passing referenced in the PR summary.
