# Phase 1 — Independent Application Foundation

## Outcome

A separately buildable Research Factory frontend at `apps/web/`, with an explicit route registry, Lumen React baseline, existing IndexedDB read compatibility, and independent CI. The current production app remains untouched.

## Work breakdown

### 1. Repository and runtime boundary
- [x] Create a dedicated feature branch from the current main commit.
- [x] Add `apps/web/` as an independent Vite/React application.
- [x] Keep root Vercel build and output settings unchanged.
- [x] Document local commands and environment variables.
- [x] Establish a temporary legacy domain/data bridge with a clear retirement rule.

### 2. Lumen and visual foundation
- [x] Pin the published `@santi020k/lumen-react@4.3.0` package.
- [x] Verify actual package exports, stylesheet entry and peer dependencies in CI.
- [ ] Define semantic color, type, spacing, radius, elevation, focus and motion tokens.
- [x] Implement responsive app shell and navigation using Lumen primitives.
- [ ] Add light/dark theme support without duplicating domain state.

### 3. Domain and storage bridge
- [x] Read projects from the existing `paperorchestra-studio` IndexedDB database.
- [ ] Preserve all Dexie migrations and record types; do not run destructive writes.
- [x] Add typed app-facing project list/read contracts.
- [x] Add storage unavailable, loading, empty and error states.
- [ ] Test that legacy records are readable and unchanged.

### 4. Route and workspace registry
- [x] Define all Research Factory stations in one registry.
- [x] Mark migrated, in-progress and not-yet-migrated routes explicitly.
- [ ] Provide guided and professional navigation modes as progressive disclosure.
- [ ] Avoid dead links and placeholder success states.

### 5. Engineering gates
- [x] Node 22 CI workflow for app typecheck, tests and build.
- [x] Existing repository regression suite remains required.
- [x] Lumen version/exports verification.
- [ ] Accessibility and responsive smoke checks.
- [ ] Browser console/network review on an isolated preview.

## Required tests

- Workspace registry contains every planned station exactly once.
- Navigation links point to registered routes.
- Project adapter returns records from the existing database without writes.
- Storage errors are represented as an error state, not an empty project library.
- App shell renders loading, empty, populated and failure states accessibly.
- Build can run from the repository root without changing the production frontend.

## Release gate

Do not switch Vercel's production build target during Phase 1. Phase 1 is complete only when the independent app's CI and preview build pass on the same commit and its existing-data read path is verified.


## Verification update — 25 November 2026

### GitHub Actions — commit `81fe09af3b36f75c81358ff8fea129d05c8f5eda`

- Replacement app dependency audit: **0 vulnerabilities**.
- TypeScript check: passed.
- Workspace registry tests: **4/4 passed**.
- Vite production build: passed (Vite 6.4.6).
- Existing repository regression suite: passed.
- Existing frontend typecheck and production build: passed.
- Root and frontend dependency audits: passed.

### Remaining Phase 1 gates

- Commit a deterministic `apps/web/package-lock.json` and switch CI install to `npm ci`.
- Add full semantic spacing/elevation tokens and theme switching.
- Verify IndexedDB read-only behavior with browser fixtures representing existing project records; confirm no writes occur.
- Run Vercel deployment smoke checks on the isolated replacement project.
- Run keyboard, screen-reader, reduced-motion and WCAG checks.
- Test responsive layouts at 320, 375, 560, 768, 1024, 1280 and 1440 CSS px.
- Inspect browser console/network and complete an independent UI/code review.

Phase 1 remains **in progress** until all remaining gates pass. No production routing or domain was changed.
