# PaperOrchestra Quality Gates and Phase 9 Implementation Plan

> **For agentic workers:** Use the native execution workflow and complete each task with its own verification and review.

**Goal:** Establish a durable engineering quality contract, then implement the Phase 9 Lumen redesign across the complete PaperOrchestra PWA without regressing research workflows or local-first guarantees.

**Architecture:** The existing React 19 + Vite PWA remains the product runtime. GitHub Actions provides deterministic blocking checks; browser automation, axe, Lighthouse and Limrun provide release evidence. Lumen owns presentation primitives while PaperOrchestra retains domain state, persistence and research logic.

**Tech Stack:** Node 22, npm lockfiles, React 19, TypeScript, Vite 6, existing Node test suite, GitHub Actions, Lumen React adapter, Playwright, axe-core, Lighthouse, Limrun, Supabase and Vercel.

**Spec:** `docs/phase9-lumen-redesign.md`

## Global Constraints

- IndexedDB remains the default local source of truth.
- Supabase remains optional and sharing remains explicit and RLS-protected.
- Preserve all existing research, discovery, writing, data, export and systematic-review behavior.
- Do not invent test coverage, bundle-size or performance baselines.
- Node 22.x and committed npm lockfiles remain authoritative.
- Vercel production deployment occurs only after the release gates pass.

## Review Focus

- Offline or unconfigured Supabase: local project workflows must remain usable.
- Semantic Scholar rate limits: cooldown and Retry-After messaging must remain visible and accurate.
- Large or malformed datasets: parsing remains bounded and errors are actionable.
- Slow WebLLM initialization or compute failures: progress, cancellation and fallback behavior remain intact.
- Existing systematic-review records: migration, decisions, identifiers and exports remain stable.

---

### Task 1: Establish the engineering contract

**Files:**
- Create: `CONSTRAINTS.md`
- Create: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-11-25-paperorchestra-quality-gates-and-phase9.md`

- [x] Inspect package manifests, lockfiles, existing test files and GitHub Actions workflow.
- [x] Record existing verified checks without inventing coverage/performance baselines.
- [x] Document required Phase 9 release checks and architecture invariants.

### Task 2: Make existing checks explicit and reliable in CI

**Files:**
- Modify: `.github/workflows/vercel-build.yml`
- Existing test suite: `tests/*.test.mjs`

- [ ] Keep pull-request validation and push validation for main, Phase 8 and Phase 9 branches.
- [ ] Add read-only workflow permissions, concurrency cancellation and a bounded job timeout.
- [ ] Install from both committed lockfiles using `npm ci`.
- [ ] Run high-severity npm audits, the full regression suite and the TypeScript/production build.
- [ ] Verify the workflow on the resulting commit; report actual results.

### Task 3: Add Phase 9 implementation foundations

**Files (final paths to confirm against the codebase):**
- Modify: `frontend/package.json` and `frontend/package-lock.json`
- Create/modify: shared Lumen theme, tokens and app-shell components under `frontend/src`
- Modify: `frontend/src/App.tsx` and route/workspace surfaces as needed
- Tests: existing regression tests plus focused component/browser tests

- [ ] Verify the published Lumen React package version and compatibility before installation.
- [ ] Add the package and update the lockfile together.
- [ ] Add failing tests for the shared shell, navigation and responsive behavior.
- [ ] Implement semantic tokens, theme foundations, navigation and page context.
- [ ] Verify typecheck, regression suite and production build.

### Task 4: Migrate Phase 1–2 surfaces

- [ ] Dashboard and project workspace use the shared Lumen system.
- [ ] Preserve create/open/search/archive/restore/delete/autosave behavior.
- [ ] Add regression coverage for all affected interactions.

### Task 5: Migrate Phase 3–4 surfaces

- [ ] Literature discovery and Writing Studio use shared primitives and responsive layouts.
- [ ] Preserve Semantic Scholar cooldown, WebLLM, local compute, autosave and export behavior.
- [ ] Add tests for loading, error, cancellation and empty states.

### Task 6: Migrate Phase 5–6 surfaces

- [ ] Data & Methods and Quality & Export use shared primitives.
- [ ] Preserve bounded parsing, worker behavior, confirmation state and export sanitization.
- [ ] Add tests for limits, truncation, failure and download behavior.

### Task 7: Migrate Phase 7–8 surfaces

- [ ] Collaboration and Systematic Review use shared primitives.
- [ ] Preserve local-only mode, opt-in sharing, RLS, review decisions, migration and export behavior.
- [ ] Add tests for permission boundaries and researcher-controlled decisions.

### Task 8: Automated browser and accessibility verification

- [ ] Add Playwright browser tests for the critical dashboard and project workflows.
- [ ] Add axe-core checks for primary routes and dialog states.
- [ ] Capture responsive screenshots at the agreed viewport widths.
- [ ] Add Lighthouse mobile/desktop baselines and performance regression reporting.
- [ ] Run the full suite and independent review.

### Task 9: Limrun device verification and release

- [ ] Test Android Chrome and iOS Safari using Limrun.
- [ ] Record screenshots, accessibility tree findings and device-specific issues.
- [ ] Resolve all critical/high findings.
- [ ] Produce release notes with exact commit SHA.
- [ ] Deploy to Vercel only after approval and perform production smoke tests.

## Completion rule

A task is complete only when its tests were executed and the results are recorded. A successful static build does not substitute for browser, accessibility, device or production verification.
