# PaperOrchestra Production Cutover — Design

**Date:** 2026-11-27  
**Status:** Approved for execution by the project owner  
**Target:** Existing Vercel production project `paper`, domain `paper-eta-mauve.vercel.app`

## Intent

Release the complete independent PaperOrchestra Research Factory frontend as the production application, preserving the existing local-first project database and the optional Supabase collaboration boundary. The goal is one coherent research environment rather than multiple partially migrated frontends.

## Goals

- Ship the active Research Factory stations: Research Station, Projects, Research Blueprint, Production Line, Intelligent Orchestration, Literature Discovery, Evidence Workspace, Writing Studio, Data & Methods, Systematic Reviews, Scientific Audit, Publication, Collaboration and Settings.
- Preserve the existing IndexedDB database, project IDs, attachments, notes, revision guards, review records and existing server/API boundaries.
- Keep Supabase collaboration opt-in, using the existing RLS-protected schema and browser-safe publishable key.
- Use the existing production Vercel project and its verified production domain.
- Verify with Node 22, strict TypeScript, unit/regression tests, Playwright, dependency audits, Vercel preview and post-promotion runtime checks.

## Non-goals and safeguards

- No automatic upload of local projects to Supabase.
- No automatic eligibility, risk-of-bias, scientific validity or publication decisions.
- No automatic journal submission or email invitation service.
- No hosted database schema changes as part of this release.
- No destructive migration or reset of IndexedDB.
- No claim that Limrun native-device testing passed while the account has no credits.

## Approaches considered

1. **Merge the old Phase 2–6 branches directly.** Rejected: these branches are divergent from the current release line and GitHub reports conflicts; they also duplicate capabilities already implemented in the current app under different component names.
2. **Promote the latest Phase 14 line and close the duplicate Phase 2–6 branches as superseded after parity verification.** Selected: the latest line contains working equivalents in `ProjectManager`, `ResearchBlueprintWorkspace`, `LiteratureDiscovery`, `EvidenceWorkspace`, `DataAnalysisWorkspace`, and `WritingStudioWorkspace`; it preserves the shared IndexedDB adapters and is the exact line already tested in preview.
3. **Create a second production project and move the domain.** Rejected: it adds avoidable domain transfer and rollback risk. Use the existing `paper` project and change its root directory to `apps/web` for the staged release.

## Architecture and deployment decision

- New application root: `apps/web`.
- Vercel root directory must be `apps/web` so the app's `api/` functions and its own `vercel.json` are discovered together.
- Production project: `paper` (`prj_5p9zCbx3FeTj0WUJHYjhjXSRDcY1`).
- Production domain: `paper-eta-mauve.vercel.app`.
- Stage a preview deployment in the production project using `apps/web` as root, validate it, then promote that exact deployment. Do not build a different artifact after validation.

## Known release limitations

- Limrun is currently unavailable because the organization has no credits. Playwright mobile viewport coverage is available as a fallback; native emulator acceptance remains unverified.
- Supabase Security Advisor reports leaked-password protection disabled. Do not change hosted Auth settings without explicit admin confirmation; document it as a security follow-up.
- Collaboration invitations currently require an existing PaperOrchestra account UUID. Shared-project refresh is manual because Realtime is not enabled on the existing collaboration tables.
- The writing workspace's remote Python/LaTeX path requires its documented engine and Redis environment variables; local browser fallbacks remain available where implemented.

## Release acceptance

- Node 22 build, strict TypeScript and all unit tests pass.
- Existing root regression suite passes.
- Playwright E2E and responsive/accessibility checks pass.
- All three dependency trees report zero high-severity audit findings.
- Staged production-project preview builds from the release commit and serves every workspace route.
- Promotion assigns the verified artifact to the existing production domain.
- Post-deploy runtime error scan is clean or every finding is triaged and documented.
