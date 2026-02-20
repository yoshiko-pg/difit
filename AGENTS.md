# Repository Guidelines

## Project Structure & Module Organization

The TypeScript sources live under `src`, split by runtime: `src/cli` handles command parsing and Git integration, `src/server` hosts the Express diff service, `src/client` renders the React web UI, `src/tui` covers the Ink terminal UI, and shared helpers sit in `src/utils` and `src/types`. Unit and integration tests live next to the code they cover as `*.test.ts` or `*.test.tsx`, and fixtures under `docs/` support screenshots and copy decks. Built artifacts land in `dist/` after `pnpm build`; do not edit them manually. Static assets for the UI reside in `public/`, while automation scripts live in `scripts/`.

## Build, Test, and Development Commands

- `pnpm install` — install workspace dependencies (Node ≥21; use `mise` to stay aligned).
- `pnpm dev` — run the local development loop (boots the CLI server and UI with hot reload).
- `pnpm build` — generate the CLI bundle and production web assets via TypeScript project references and Vite.
- `pnpm test` / `pnpm test:watch` — execute the Vitest suite once or in watch mode.
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, and `pnpm typecheck` — apply Oxlint type-aware checks, Biome formatting, and strict TS analysis before you commit.

## Coding Style & Naming Conventions

The codebase uses strict TypeScript (`tsconfig.strictest`) and 2-space indentation; avoid `any` and prefer explicit types. Import types with `import type` and keep module order consistent; Oxlint enforces unused imports/variables and type-aware safety rules. React components live under `src/client` or `src/tui`; use PascalCase filenames for components, kebab-case for utilities, and co-locate UI-specific helpers when practical. Run `pnpm format` before submitting to apply Biome formatting.

## Testing Guidelines

Vitest with the `happy-dom` environment drives unit and integration coverage, and React work should lean on Testing Library helpers. Place new tests alongside the implementation using the `name.test.ts[x]` pattern and prefer descriptive `describe` blocks tied to features. Ensure asynchronous flows await their assertions and cover both CLI (`src/cli`) and server (`src/server`) branches when they change; use `pnpm test --runInBand` if watchers behave flakily in CI.

## Commit & Pull Request Guidelines

Git history mixes lightweight descriptions with Conventional Commit prefixes—follow the pattern where it clarifies intent: `fix: guard empty diff (#123)` or `feat(cli): add --port flag`. Keep commits focused, include context in the body, and reference issues with `#id` when relevant. Before opening a PR, ensure `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` succeed locally; lefthook re-runs them on commit and push. PRs should outline motivation, implementation notes, manual verification steps, and UI changes (attach refreshed `docs/images` assets or screenshots for web/TUI updates).

## Tooling & Environment

Use `pnpm` for dependency management (avoid mixing with `npm` or `yarn`) and rely on the `mise.toml` pinned versions for local reproducibility. When performance is a concern, run `pnpm perf:*` scripts to benchmark diff rendering before merging significant parser or rendering changes.
