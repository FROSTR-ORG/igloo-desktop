# Repository Guidelines

## Project Structure & Module Organization
- Electron main process lives in `src/main.ts`; the React renderer boots from `src/renderer.tsx`.
- UI components stay under `src/components/`; shared helpers go in `src/lib/`; cross-cutting types belong to `src/types/`.
- Tests mirror runtime code inside `src/__tests__/`, with `integration/`, `performance/`, and `__mocks__/` folders matching the feature they cover.
- Packaged assets ship from `src/assets/` and the public HTML shell sits in `public/`; production bundles land in `dist/` and signed artifacts in `release/`.

## Build, Test, and Development Commands
- `npm run dev` runs the webpack watcher and starts Electron for live reloading during feature work.
- `npm start` performs a clean build before launching the packaged desktop app.
- `npm run build` emits production bundles into `dist/` for distribution and signing.
- `npm test` executes the Jest suite once; use `npm run test:watch` while iterating locally.
- `npm run lint` auto-fixes ESLint issues; `npm run lint:check` keeps CI read-only.

## Coding Style & Naming Conventions
- All runtime code is TypeScript with two-space indentation and required semicolons.
- Favor functional React components; name components with PascalCase and helper functions with camelCase.
- Filenames in `src/components/` use kebab-case `button-group.tsx` style.
- Import third-party packages before internal modules; use the `@/` alias for local paths (e.g., `@/components/share-list`).
- Style JSX with Tailwind utility classes; reserve inline styles for dynamic values only.

## Testing Guidelines
- Jest with Testing Library drives renderer specs; place new tests beside features as `<subject>.test.tsx`.
- Register global mocks through `src/__tests__/setup.ts` and reuse fixtures from `src/__tests__/__mocks__/`.
- Cover new IPC handlers with unit tests and at least one scenario under `src/__tests__/integration/`.
- Run `npm test -- --runInBand` when debugging Electron flakiness to serialize the suite.

## Commit & Pull Request Guidelines
- Write imperative commit subjects (e.g., “Add share unlock modal”) and include bullet details plus issue refs such as `Refs #123`.
- Document PR changes clearly, attach screenshots or recordings for UI updates, and list test commands run (`npm test`, `npm run lint`).
- Note installer or release impacts whenever a change touches `dist:*` scripts or packaging configs.

## Security & Configuration Tips
- Keep secrets in environment variables or OS keychains; never commit them to the repo.
- Store signing certificates with restricted access and rotate credentials when contributors change.
- Document new configuration toggles in `README.md` or the relevant script under `build/` or `scripts/`.
