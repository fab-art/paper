# Phase 2–6 Migration Parity Audit

**Date:** 27 November 2026  
**Release source:** `release/research-factory-production-cutover`  
**Decision:** Preserve the active implementations in `apps/web/`; do not merge the older divergent Phase 2–6 branches directly.

## Why the old pull requests are not merged as-is

The former PRs #21–25 were created from an earlier revision of the independent frontend branch. Their commit histories have diverged from the current Phase 14 line, and GitHub reports conflicts on the Phase 2 branch. The current release line already contains the same product capabilities in a different, integrated component structure. Merging those PRs would introduce a second implementation of several workspaces and risk duplicate routes, duplicated persistence logic and regressions to the existing IndexedDB adapter.

The correct integration is therefore a feature-parity integration, not a raw branch merge. Once this audit and the release verification are accepted, close PRs #21–25 as superseded and link them to the consolidated release PR.

## Capability mapping

| Earlier phase | Previous PR | Current implementation | Parity notes |
|---|---:|---|---|
| Phase 2 — Project Workspace | #21 | `ProjectManager.tsx`, `project-management.mjs`, `legacy-projects.ts` | Project creation/editing, question/objectives/methodology, status, milestones, literature, notes, attachments, archive/restore and permanent deletion use the existing local project store. |
| Phase 3 — Research Blueprint & Protocol | #22 | `ResearchBlueprintWorkspace.tsx`, `ProductionLineWorkspace.tsx`, `research-orchestration.mjs` | Blueprint completeness, owner approval, version invalidation, task dependencies and researcher-confirmed completion are active. |
| Phase 4 — Literature Discovery & Evidence | #23 | `LiteratureDiscovery.tsx`, `EvidenceWorkspace.tsx`, `EvidenceIntelligence.tsx`, `literature-discovery.mjs`, `evidence-appraisal.mjs` | Semantic Scholar discovery, DOI/title deduplication, BibTeX, claim/source traceability, protocol methods, study extraction and researcher-led appraisal are active. |
| Phase 5 — Data & Methods | #24 | `DataMethodsLab.tsx`, `DataAnalysisWorkspace.tsx`, `dataset-analysis.mjs`, `data-methods-worker.ts` | Local CSV/TSV parsing, bounded previews, variable profiles and transparent dataset summaries are active. |
| Phase 6 — Writing Studio | #25 | `WritingStudioWorkspace.tsx`, `Studio.tsx`, `writing-document.mjs`, `LocalPythonPanel.tsx` | Local manuscript editing, autosave/revision guards, WebLLM options, LaTeX/BibTeX, templates, notes/data import and optional local compute are active. |

## Data and security boundaries retained

- All phases use the existing `paperorchestra-studio` IndexedDB database; no parallel project store is introduced.
- Project updates retain revision/tombstone guards and existing project IDs.
- Attachments and notes remain local browser records.
- Supabase collaboration remains an explicit opt-in in Phase 14; no automatic local-to-cloud upload is added.
- The existing Supabase RLS policies remain the authorization boundary. No service-role key is added to browser code.
- AI agents do not make automatic scientific eligibility, quality, risk-of-bias or publication decisions.

## Verification evidence

The Phase 14 release line was checked from a clean clone under Node.js 22.23.5:

- Research Factory unit tests: **74 passed, 0 failed**.
- Playwright browser tests: **25 passed, 0 failed**, including project/library navigation, Literature Discovery, Evidence Workspace, Writing Studio, planning workflows, responsive widths and WCAG 2.2 A/AA checks.
- Existing repository regression suite: **168 passed, 0 failed**.
- Root, legacy frontend and Research Factory dependency audits: **0 vulnerabilities**.
- TypeScript strict check and Vite production build: **passed**.

The release branch adds additional project-management and Publish/Manage route E2E coverage before production promotion.

## Remaining distinctions and honest limitations

- The old branches are not merged because their implementation is superseded, not because their features were discarded.
- Systematic Reviews, Scientific Audit, Publication, Collaboration and Settings are later phases already present on the Phase 14 release line.
- Limrun native iOS/Android acceptance remains unverified because the account currently has no credits. Playwright mobile viewport coverage is not represented as native-device testing.
- Supabase leaked-password protection is disabled according to Security Advisor. It requires a Supabase Auth administrator setting change and is not modified by this release branch.
- Collaboration membership currently uses existing account UUIDs; no email-invitation service is claimed. Collaboration detail refresh is manual because Realtime is not enabled for the current tables.

## Release decision

Use the consolidated Phase 14 line as the sole release candidate. After the added E2E checks and staged Vercel preview pass, merge the consolidated release PR to `main`, close superseded PRs #20–29 with a link to the release PR, and promote the exact staged deployment to `paper-eta-mauve.vercel.app`.
