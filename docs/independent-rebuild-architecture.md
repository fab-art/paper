# PaperOrchestra — Independent Frontend Replacement Architecture

**Status:** Approved implementation baseline  
**Decision:** Approach B — build a separate frontend and cut over only after feature parity and release verification.  
**Branch:** `feat/independent-research-factory-rebuild`  
**Production:** unchanged; the existing Vercel build continues to target `frontend/`.

## 1. Objective

Replace the current PaperOrchestra frontend with a new, independently structured Research Factory application while preserving every supported research capability, existing user data, security boundary, and compute integration.

This is a frontend replacement, not a backend or data reset. The legacy application remains the reference implementation and compatibility layer until the new app has passed the migration and release gates.

## 2. Non-negotiable product principles

1. **No data reset or destructive migration.** Existing IndexedDB databases, project IDs, project records, notes, attachments, search history, research blueprints, review decisions, tombstones, revision guards, and migrations remain readable.
2. **Local-first remains the default.** IndexedDB is the default source of truth. Cloud collaboration is opt-in; no automatic upload of local projects.
3. **Researcher authority.** AI proposes and prepares. The owner retains authority over research questions, protocol decisions, eligibility decisions, analysis interpretation, authorship, ethics and submission.
4. **Evidence traceability.** Claims, citations, figures, tables, analysis runs and quality findings retain provenance.
5. **Preserve working engines.** WebLLM, Semantic Scholar proxy/cache/cooldown, Python compute, LaTeX compilation, export sanitization, and Supabase RLS protections are not rewritten as part of the visual shell.
6. **Independent release.** The replacement is developed and tested separately. Production routing changes only after explicit cutover approval.
7. **No fake metrics.** Counts, status, progress and availability are derived from actual records or explicitly marked unavailable.
8. **Progressive disclosure.** Guided mode is beginner-friendly; Professional mode exposes protocol, scripts, parameters, provenance and agent details without duplicating project state.

## 3. Repository strategy

### Current application (legacy reference)

- `frontend/`: existing React 19 + Vite application and all current workspace components.
- `api/`, `backend/`, `desktop/`: existing search and compute services.
- `supabase/`: collaboration schema and security migrations.
- `upstream/paper-orchestra/`: upstream Google Research source and templates.
- `tests/`: existing regression suite.

### New application

- `apps/web/`: independent React 19 + Vite application.
- `apps/web/src/app/`: application shell, route composition and providers.
- `apps/web/src/features/`: product workspaces, migrated one at a time.
- `apps/web/src/domain/`: stable domain contracts and pure business logic.
- `apps/web/src/adapters/`: IndexedDB, legacy bridge, AI, search, compute, cloud and export adapters.
- `apps/web/src/design-system/`: Lumen composition, app tokens and reusable product patterns.
- `apps/web/tests/`: new application tests.

The initial application may import stable legacy domain/data modules through a temporary, explicit compatibility bridge. It must not fork or silently redefine their data contracts. As a capability is migrated, its adapter becomes the new app's supported boundary and the bridge is retired only after parity tests pass.

## 4. Target architecture

```
apps/web (new application)
  App shell / route registry
    Feature workspaces
      Domain services and typed contracts
        Adapters
          IndexedDB (existing database name and schema)
          Semantic Scholar / Vercel API
          WebLLM worker
          Python + LaTeX compute proxy
          Optional Supabase collaboration
          Import / export
```

### Boundaries

- **UI:** React components and Lumen primitives; no direct database or network calls inside presentation components.
- **Features:** own route-level UI and feature orchestration; consume domain services through adapters.
- **Domain:** framework-independent records, validation, workflow transitions and provenance rules.
- **Adapters:** translate existing storage, API, worker and service contracts into stable app-facing interfaces.
- **Infrastructure:** deployment, service configuration, telemetry and release health.

### Dependency direction

`UI → feature application services → domain contracts ← adapters → existing infrastructure`

The new frontend must not import old visual components or old global styles. Temporary imports from legacy `lib/` modules are allowed only for data/domain compatibility and must be listed in the migration inventory.

## 5. Design system

- Framework: React 19 + TypeScript + Vite.
- Component system: Lumen React, with the published `@santi020k/lumen-react@4.3.0` adapter pinned until a later version is publicly published and independently verified.
- Icons: Lucide React.
- Product character: premium, editorial, calm research workstation; warm neutral canvas, restrained teal/ink accent, readable typography, fine borders, purposeful density.
- Responsive targets: 320, 375, 560, 768, 1024, 1280 and 1440 CSS px.
- Accessibility: semantic landmarks, keyboard-first navigation, visible focus, accessible dialogs, reduced motion, WCAG AA contrast, status announcements and touch targets.
- Lumen owns primitive behavior and accessible interaction. PaperOrchestra owns product workflows, content, state and domain semantics.

### Lumen version gate

The connected Lumen MCP catalog currently reports 5.3.0 contracts, while the public npm package and current repository dependency resolve to 4.3.0. Do not generate v5-specific code against the v4 package. Use installed package exports/types and v4.3.0 documentation; rerun compatibility checks before any package upgrade. The MCP catalog mismatch is a documented integration constraint, not permission to silently upgrade.

## 6. Feature parity and migration inventory

| Capability | Existing source of truth | Replacement requirement |
|---|---|---|
| Research Station / projects | `frontend/src/components/Dashboard.tsx`, `lib/db.ts` | Search, filters, recent/archived projects, create/open/archive/restore/delete and true empty/error states |
| Project workspace | `ProjectWorkspace.tsx`, `lib/db.ts` | Overview, objectives, methodology, notes, attachments, milestones, save status and revision safety |
| Research Blueprint / intake | `lib/research-blueprint.ts`, `lib/research-intake.ts` | One canonical versioned project model, guided/professional mode and owner-confirmed decisions |
| Production line / agents | `lib/research-production-line.ts`, `lib/research-agent-executor.ts` | Task dependencies, agent contracts, pause/approval controls, audit events and traceable outputs |
| Literature discovery | `ResearchDiscovery.tsx`, `api/search-papers.ts`, `api/search-cache.mjs` | Search, rate-limit cooldown, cache, history, deduplication and saved sources |
| Evidence workspace | `ResearchEvidenceWorkspace.tsx`, `lib/evidence-intelligence.ts` | Source records, screening/extraction support, evidence matrix and claim-source traceability |
| Writing Studio | `Studio.tsx`, `lib/llm.ts` | Browser-local model lifecycle, agent execution, manuscript/LaTeX editor, plots and compile preview |
| Data & Methods | `DataMethodsLab.tsx`, worker and compute APIs | CSV/TSV parsing, file bounds, profiling, reproducible scripts, analysis outputs and figure provenance |
| Quality & export | `SubmissionReadiness.tsx`, `lib/export.ts` | Deterministic checks, owner confirmations, ZIP and individual exports, formula neutralization |
| Systematic reviews | `SystematicReviewWorkspace.tsx`, `lib/systematic-review.mjs` | Protocol, screening decisions, full-text tracking, extraction, risk of bias, counts and sanitized exports |
| Collaboration | `AuthPanel.tsx`, `lib/supabase.ts`, `supabase/migrations/` | Optional auth/share/sync, RLS-backed roles, conflicts, outbox and local-only mode |
| Local Python / LaTeX | `LocalPythonPanel.tsx`, `api/engine/`, `backend/`, `desktop/` | Protected API adapter, health/error state and local companion support |
| PWA / offline | `vite.config.ts`, manifest and workers | Installability, explicit cache policy and offline-safe local workflows |

## 7. Data compatibility rules

- Preserve the IndexedDB database name `paperorchestra-studio` and all current Dexie schema versions.
- Do not create a second database as the new app's default.
- Preserve stable project IDs and all nested data structures.
- Preserve project revision checks, write guards, tombstones, archive/restore semantics and multi-tab conflict behavior.
- Preserve the one-way legacy-to-Research-Blueprint migration behavior; never overwrite richer canonical records with a legacy editor snapshot.
- Treat attachments as binary records; verify import/export round trips.
- Keep Supabase optional and keep authorization in RLS. Hiding controls is not an authorization boundary.
- Any future schema change requires a forward migration, rollback strategy, backup/export path and migration tests.

## 8. API and service compatibility

Create typed adapters for:
- paper search and cache;
- WebLLM worker and model state;
- remote compute proxy and local Python companion;
- LaTeX compile and export;
- Supabase auth, collaboration and sync;
- project import/export.

Keep existing endpoint paths and request/response semantics until contract tests prove a compatible replacement. Secrets remain server-side. The browser must never receive the Railway engine token, service-role credentials or other privileged secrets.

## 9. Migration sequence

1. **Phase 1 — Independent foundation:** new app package, Lumen baseline, route registry, application shell, IndexedDB read adapter, CI gates and isolated preview build.
2. **Phase 2 — Project library:** dashboard, search/filter, create/open/archive/restore/delete, empty/loading/error states and local persistence.
3. **Phase 3 — Project workspace:** overview, notes, attachments, objectives, milestones, autosave and revision/conflict handling.
4. **Phase 4 — Research Blueprint and orchestration:** guided intake, canonical state, production line, owner approvals and audit trace.
5. **Phase 5 — Literature and evidence:** discovery, rate limits/cache, saved papers, deduplication, screening/extraction support and evidence matrix.
6. **Phase 6 — Writing Studio:** editor, WebLLM, agents, LaTeX, plots and compute integration.
7. **Phase 7 — Data, quality and exports:** dataset workflows, methods, quality checks, package generation and sanitization.
8. **Phase 8 — Systematic Review:** protocol, screening, extraction, bias, PRISMA-style working counts and exports.
9. **Phase 9 — Collaboration and offline hardening:** opt-in Supabase, RLS, sync conflict behavior, PWA and local companion parity.
10. **Phase 10 — Cutover qualification:** feature parity audit, migration/rollback rehearsal, accessibility, security, performance, browser/device tests and independent review.

Phases may be re-sequenced when dependencies require it, but no phase is considered complete on visual similarity alone.

## 10. Quality gates

Every phase:
- focused unit and integration tests;
- all relevant legacy regression tests;
- TypeScript strict build and production bundle;
- lint/static checks where configured;
- accessibility checks (automated plus keyboard/screen-reader review);
- responsive browser verification at required widths;
- console/network inspection and key workflow smoke tests;
- security review for data access, auth, secrets and user-supplied content;
- independent code review with findings resolved or explicitly accepted.

Release:
- CI green on the exact release commit;
- Vercel Preview READY for the exact commit;
- no critical/high unresolved security or data-integrity issues;
- all capabilities in the parity inventory accounted for;
- IndexedDB preservation and rollback rehearsed with representative data;
- production environment variables and domains reviewed;
- explicit owner approval before changing the production build target/domain.

## 11. Cutover and rollback

Until cutover, the root `vercel.json` and current Vercel production build remain unchanged. The new app receives an isolated preview deployment. At cutover, update the Vercel project build target only after approval, retain the legacy frontend and services for a rollback window, and monitor error rates, storage access, API health and user workflows. Rollback restores the previous deployment/build target; it must not roll back or delete user data.

## 12. Phase 1 exit criteria

- New app exists under `apps/web/` and can build independently.
- New app has no dependency on legacy UI components or legacy global CSS.
- Lumen React is pinned to the published version and imports are verified against the installed package.
- New app can read existing local projects from the existing IndexedDB database without modifying them.
- Route/workspace registry is explicit and test-covered.
- CI validates typecheck, tests and production build.
- Root Vercel production configuration remains unchanged.
- A preview can be built without exposing secrets or mutating production.
