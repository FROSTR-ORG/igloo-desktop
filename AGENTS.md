# Repository Guidelines

## Project Structure & Module Organization
- Main Electron process lives in `src/main.ts`; the renderer bootstraps from `src/renderer.tsx`.
- UI components sit under `src/components/`, helpers in `src/lib/`, shared types in `src/types/`.
- Tests mirror runtime code under `src/__tests__/` with `integration/`, `performance/`, and `__mocks__/` for feature-specific coverage.
- Assets reside in `src/assets/`; the HTML shell is in `public/`; production bundles land in `dist/` and release artifacts in `release/`.

## Build, Test, and Development Commands
- `npm run dev` starts the webpack watcher and Electron for live reload during feature work.
- `npm start` performs a clean build then launches the packaged desktop app for verification.
- `npm run build` emits production bundles into `dist/` for distribution and signing flows.
- `npm test` runs the Jest suite once; `npm run test:watch` keeps tests hot while iterating.
- `npm run lint` applies ESLint auto-fixes; use `npm run lint:check` to validate without writing.

## Coding Style & Naming Conventions
- All runtime code is TypeScript with two-space indentation and required semicolons.
- Prefer functional React components; name them in PascalCase and helpers in camelCase.
- Components in `src/components/` follow kebab-case filenames (e.g., `share-list.tsx`).
- Import third-party packages before internal modules and use the `@/` alias for local paths.
- Tailwind utility classes style JSX; reserve inline styles for dynamic values only.

## Testing Guidelines
- Jest with Testing Library powers renderer specs; place new tests beside features as `<subject>.test.tsx`.
- Register shared mocks in `src/__tests__/setup.ts` and reuse fixtures from `src/__tests__/__mocks__/`.
- Cover new IPC handlers with unit tests plus at least one scenario in `src/__tests__/integration/`.
- Debug flaky Electron tests with `npm test -- --runInBand` to serialize execution.

## Commit & Pull Request Guidelines
- Write imperative commit subjects (e.g., “Add share unlock modal”) followed by bullet details and issue references like `Refs #123`.
- PRs should describe the change set, include screenshots or recordings for UI tweaks, and list run commands (`npm test`, `npm run lint`).
- Call out installer or release impacts whenever changes touch `dist:*` scripts or packaging configs.

## Security & Configuration Tips
- Keep secrets in environment variables or OS keychains; never commit sensitive values.
- Store signing certificates with restricted access and rotate credentials when contributors change.
- Document new configuration toggles in `README.md` or relevant scripts under `build/` or `scripts/`.
