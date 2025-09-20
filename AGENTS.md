# Repository Guidelines

## Project Structure & Module Organization
The Electron main process lives in `src/main.ts`; the renderer React entry is `src/renderer.tsx`. Components sit in `src/components`, shared utilities in `src/lib`, and domain types in `src/types`. Tests mirror runtime modules under `src/__tests__` with `integration/`, `performance/`, and `__mocks__/`. Packaged assets stay in `src/assets`; `public/` holds the static shell. Build and signing helpers live in `build/` and `scripts/`. Generated bundles land in `dist/`, while installers and notarized artifacts are written to `release/`.

## Build, Test, and Development Commands
Install dependencies once with `npm install`. `npm run dev` starts webpack watch plus Electron; `npm start` performs a fresh build before launch. `npm run build` compiles production assets to `dist/`; `npm run watch` keeps TypeScript transpiling. `npm test` and `npm run test:watch` drive Jest suites. Lint locally with `npm run lint` (auto-fix) or `npm run lint:check`. Packaging commands include `npm run dist` or platform-specific variants like `npm run dist:mac`, `npm run dist:win`, and `npm run dist:linux`.

## Coding Style & Naming Conventions
Write TypeScript everywhere under `src/` and prefer functional React components. Keep two-space indentation, camelCase for functions, PascalCase for components, and kebab-case for files under `components/`. Import third-party modules before local ones and use the `@/` alias for internal paths. Tailwind utility classes belong in JSX; avoid inline styles unless conditional. Run `npm run lint` before commits—ESLint enforces `typescript-eslint`, React, and Hooks rules, so address warnings instead of suppressing them.

## Testing Guidelines
Place unit specs beside their feature folder inside `src/__tests__/<area>` and name files `<subject>.test.tsx`. Testing Library powers renderer tests; share mocks through `__mocks__` and register globals in `src/__tests__/setup.ts`. Cover new IPC handlers with direct unit tests plus at least one integration case in `integration/`. Use `npm test -- --runInBand` when debugging Electron flakiness, and keep performance baselines in `performance/` with reproducible metrics noted in the test description.

## Commit & Pull Request Guidelines
Commits follow short imperative subjects ("Adjust share export dialog") with optional indented bullet details pointing to touched files, as seen in recent history. Reference issues in the body (`Refs #123`) and note user-facing changes or release impacts. Pull requests should include: summary, screenshots or recordings for UI work, explicit test plan (`npm test`, `npm run lint`), platform build notes when `dist:*` scripts change, and updated release notes when installer behavior shifts.
