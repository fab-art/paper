# Phase 1 — Independent Application Foundation

## Outcome

A separately buildable Research Factory frontend at `apps/web/`, with an explicit route registry, Lumen React baseline, existing IndexedDB read compatibility, and independent CI. The current production app remains untouched.

## Work breakdown

### 1. Repository and runtime boundary
- [x] Create a dedicated feature branch from the current main commit.
- [ ] Add `apps/web/` as an independent Vite/React application.
- [ ] Keep root Vercel build and output settings unchanged.
- [ ] Document local commands and environment variables.
- [ ] Establish a temporary legacy domain/data bridge with a clear retirement rule.

### 2. Lumen and visual foundation
- [ ] Pin the published `@santi020k/lumen-react@4.3.0` package.
- [ ] Verify actual package exports, stylesheet entry and peer dependencies in CI.
- [ ] Define semantic color, type, spacing, radius, elevation, focus and motion tokens.
- [ ] Implement responsive app shell and navigation using Lumen primitives.
- [ ] Add light/dark theme support without duplicating domain state.

### 3. Domain and storage bridge
- [ ] Read projects from the existing `paperorchestra-studio` IndexedDB database.
- [ ] Preserve all Dexie migrations and record types; do not run destructive writes.
- [ ] Add typed app-facing project list/read contracts.
- [ ] Add storage unavailable, loading, empty and error states.
- [ ] Test that legacy records are readable and unchanged.

### 4. Route and workspace registry
- [ ] Define all Research Factory stations in one registry.
- [ ] Mark migrated, in-progress and not-yet-migrated routes explicitly.
- [ ] Provide guided and professional navigation modes as progressive disclosure.
- [ ] Avoid dead links and placeholder success states.

### 5. Engineering gates
- [ ] Node 22 CI workflow for app typecheck, tests and build.
- [ ] Existing repository regression suite remains required.
- [ ] Lumen version/exports verification.
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
