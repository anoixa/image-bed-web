# Repository Guidelines

## Project Structure & Module Organization

This is a React 19, TypeScript, and Vite frontend. Application code lives in `src/`:

- `src/pages/`: route-level screens such as `Settings.tsx` and `Users.tsx`.
- `src/components/`: reusable feature components; `components/ui/` contains shared UI primitives.
- `src/api/`: domain-specific API wrappers built on `src/lib/request.ts`.
- `src/store/`: Zustand stores for authentication and storage configuration.
- `src/types/`: shared API and domain types.
- `public/`: static assets. `scripts/embed.go.template` supports embedding `dist/` in the Go backend.

Use the `@/` alias for imports from `src`. Keep business API calls in `src/api/`, not inline in UI primitives.

## Build, Test, and Development Commands

- `npm install`: install dependencies for local development.
- `npm run dev`: start the Vite development server with API proxies.
- `npm run lint`: run ESLint across TypeScript and React files.
- `npm run test:run`: run the Vitest suite once for CI-style verification.
- `npm test`: run Vitest in watch mode during development.
- `npm run build`: run TypeScript project checks, then create the production bundle in `dist/`.
- `npm run preview`: serve the production bundle locally for verification.

Before submitting changes, run `npm run lint`, `npm run test:run`, and `npm run build`.

## Coding Style & Naming Conventions

TypeScript strict mode is enabled. Use functional React components and hooks. Follow existing formatting: two-space indentation, semicolons in feature code, and single quotes. Name components and files with PascalCase (`UploadModal.tsx`), hooks with `use...`, and functions/variables with camelCase. Prefer `type` imports and typed API boundaries; avoid `any`, unchecked assertions, and duplicated request logic.

## Testing Guidelines

Tests use Vitest, React Testing Library, jsdom, and MSW. Use behavior-focused names such as `UploadModal.test.tsx` or `auth.test.ts`. Cover failure paths, request races, authorization, and partial batch results. Do not rely only on snapshots or implementation-detail assertions. Keep shared test setup in `src/test/`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, and `refactor(scope): ...`. Keep commits focused and use imperative summaries, for example `fix(upload): map partial batch results correctly`.

Pull requests should include a concise problem statement, implementation summary, verification commands, and linked issue when applicable. Include screenshots or recordings for visible UI changes. Call out API contract, authentication, configuration, or migration impacts explicitly.

## Security & Configuration Tips

Do not commit `.env`, credentials, tokens, OAuth secrets, or storage keys. Configure API targets through environment variables. Never persist access tokens or log sensitive request payloads. Treat frontend route guards as UX controls; backend authorization remains mandatory.
