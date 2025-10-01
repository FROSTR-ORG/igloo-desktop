# Repository Guidelines

## Project Structure & Module Organization
- Electron main process: `src/main.ts`; React renderer boot: `src/renderer.tsx`.
- UI components in `src/components`; shared helpers in `src/lib`; domain types in `src/types`.
- Tests mirror runtime code under `src/__tests__/` with `integration/`, `performance/`, and `__mocks__/`.
- Packaged assets in `src/assets`; public HTML shell in `public/`; production bundles in `dist/`; signed artifacts in `release/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies once after cloning.
- `npm run dev` — launch webpack watch plus Electron for rapid development.
- `npm start` — perform a clean build, then open the app.
- `npm run build` — compile production assets into `dist/`.
- `npm run watch` — keep TypeScript transpiling in the background.
- `npm test` / `npm run test:watch` — run Jest suites once or in watch mode.
- `npm run lint` / `npm run lint:check` — auto-fix or validate ESLint rules.

## Coding Style & Naming Conventions
- Write TypeScript across `src/` with two-space indentation and semicolons.
- Prefer functional React components. Components: PascalCase; functions/variables: camelCase; filenames in `src/components`: kebab-case.
- Import third‑party modules before local ones; use the `@/` alias for internal paths (e.g., `import Button from '@/components/button'`).
- Express styling with Tailwind utilities in JSX; reserve inline styles for dynamic cases only.

## Testing Guidelines
- Use Jest with Testing Library for renderer tests. Centralize mocks in `src/__tests__/__mocks__/` and register globals via `src/__tests__/setup.ts`.
- Name specs as `<subject>.test.tsx` beside feature folders.
- New IPC handlers require unit coverage plus at least one `integration/` suite.
- When investigating Electron flakiness, run `npm test -- --runInBand`; track metrics in `performance/`.

## Commit & Pull Request Guidelines
- Commit subjects are imperative (e.g., “Adjust share export dialog”); add bullet details and reference issues (e.g., `Refs #123`).
- PRs summarize changes, include screenshots/recordings when UI changes, list test plans (`npm test`, `npm run lint`), and note installer/release impacts when `dist:*` scripts change.

## Security & Configuration Tips
- Store secrets outside the repo; use environment variables or platform keychains.
- Keep signing certificates under restricted access and rotate credentials when team membership changes.
- Document new configuration toggles in `README.md` or relevant scripts under `build/` or `scripts/`.
