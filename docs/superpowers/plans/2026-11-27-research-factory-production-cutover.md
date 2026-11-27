# Research Factory Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the complete Research Factory release line, verify all migrated workspaces, and promote the verified artifact to the existing PaperOrchestra production domain.

**Architecture:** Use the current Phase 14 line as the release source because it contains the active equivalents of the old Phase 2–6 features and the later workspaces. Keep the existing IndexedDB data model and Supabase RLS boundary. Stage the release in the existing Vercel production project with root directory `apps/web`, test that exact deployment, then promote it.

**Tech Stack:** GitHub, React 19, TypeScript, Vite, Lumen React 4.3.0, IndexedDB/Dexie, Supabase, Vercel, Node 22, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-research-factory-production-cutover-design.md`

## Global Constraints

- Keep IndexedDB database name `paperorchestra-studio` and existing record IDs/schema compatibility.
- Keep local-first as default; cloud sharing must remain explicit.
- Never expose Supabase service-role keys to the browser.
- Preserve RLS as the collaboration authorization boundary.
- Use Node.js 22.x for release verification and Vercel production builds.
- Do not claim Limrun native testing passed without an emulator run.
- Do not perform hosted Supabase schema/Auth changes without explicit authorization.

## Review Focus

- Existing project records, attachments and notes remain readable and editable after direct-route loads.
- Stale or duplicate Phase 2–6 branches do not overwrite newer workspace implementations.
- Refreshing collaboration data reloads selected-project detail records, not only the project list.
- Supabase auth state changes load the signed-in user's profile rather than clearing the display name permanently.
- Production root-directory changes preserve API routes, rewrites and environment variable availability.

---

### Task 1: Consolidate migration status

**Files:**
- Modify: `README.md`
- Create: `docs/release/phase2-6-parity-audit.md`

- [ ] Record the current equivalent implementation for each old Phase 2–6 capability.
- [ ] Verify the old Phase 2–6 branches are divergent and not safe to merge directly.
- [ ] Close the superseded Phase 2–6 PRs only after the parity audit is committed.
- [ ] Retarget the full Phase 14 release PR to `main`; close ancestor PRs once the consolidated release PR is the sole release path.

### Task 2: Correct stale product status and documentation

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/README.md`
- Modify: `README.md`
- Modify: `docs/phase9-lumen-redesign.md`

- [ ] Replace the obsolete Phase 1 read-only empty-library message with the current project creation guidance.
- [ ] Update the app README to describe active project CRUD and local writes.
- [ ] Update the root README's production/cutover status.
- [ ] Correct only present-tense documentation that incorrectly says Lumen is not installed or that the app remains read-only.

### Task 3: Fix collaboration and account refresh behavior

**Files:**
- Modify: `apps/web/src/components/CollaborationWorkspace.tsx`
- Modify: `apps/web/src/components/SettingsWorkspace.tsx`
- Test: `apps/web/tests/manage-workspaces.test.mjs`

- [ ] Add regression tests for reloading selected collaboration details and loading the profile after auth-state changes.
- [ ] Run the tests to verify they fail for the existing behavior.
- [ ] Implement minimal fixes: refresh selected detail data after list refresh; load profile data for each authenticated session transition with cancellation protection.
- [ ] Run the targeted tests and complete app test suite.

### Task 4: Add end-to-end coverage for release workspaces

**Files:**
- Create: `apps/web/e2e/project-management.spec.ts`
- Create: `apps/web/e2e/publish-manage-workspaces.spec.ts`

- [ ] Test project creation, edit/save/reload, milestone, notes, attachment upload/download/delete and archive/restore.
- [ ] Test direct-route load and responsive layouts for Systematic Reviews, Scientific Audit, Publication, Collaboration and Settings.
- [ ] Keep cloud/auth tests isolated from real user accounts; test unauthenticated and configuration states without touching production data.
- [ ] Run all Playwright tests.

### Task 5: Full verification and review

**Files:**
- No production source changes unless a test exposes a defect.

- [ ] Install root, legacy frontend and new frontend dependencies from lockfiles.
- [ ] Run dependency audits for all three dependency trees.
- [ ] Run app strict typecheck, unit tests and Vite production build.
- [ ] Run Playwright E2E and the legacy root regression suite.
- [ ] Run code/security review on the complete release diff.
- [ ] Inspect Supabase security, performance and health advisors; document any hosted setting that needs an administrator.

### Task 6: Stage the production-project preview

**Files:**
- No application source changes.

- [ ] Create a preview deployment in Vercel project `paper` from the exact release commit.
- [ ] Set project root directory to `apps/web` and use the app's checked-in Vercel configuration.
- [ ] Confirm required production environment variable names are present without exposing secret values.
- [ ] Verify the root and all workspace direct routes, API endpoints, browser console and runtime logs.
- [ ] Do not promote if the preview build or smoke checks fail.

### Task 7: Promote and verify production

**Files:**
- No application source changes.

- [ ] Promote the exact verified staged deployment.
- [ ] Verify the production domain resolves to the promoted deployment.
- [ ] Check production runtime errors and logs for the first hour window.
- [ ] Verify the 14 workspace routes and the API/search boundary.
- [ ] Keep the prior production deployment available for rollback.

## Commands and expected gates

Run with Node 22:

```bash
npm ci
npm --prefix frontend ci
npm --prefix apps/web ci
npm audit --audit-level=high
npm --prefix frontend audit --audit-level=high
npm --prefix apps/web audit --audit-level=high
npm --prefix apps/web run build
npm --prefix apps/web run test:e2e
npm run test:regression
```

Expected: all audits report zero vulnerabilities; app typecheck and unit tests pass; Playwright and repository regression tests pass; Vercel preview is READY before promotion.
