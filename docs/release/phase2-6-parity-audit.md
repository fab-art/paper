# Phase 2–6 Migration Parity Audit

**Date:** 27 November 2026  
**Release source:** `release/research-factory-production-cutover`  
**Decision:** Preserve the integrated implementations in `apps/web/` and the compatible Stage 2 research modules; do not merge divergent historical branches directly.

## Why the old pull requests are not merged as-is

The former PRs #21–25 were created from an earlier revision of the independent frontend branch. Their commit histories have diverged from the current release line, and GitHub reports conflicts on the older Phase 2 branch. PRs #18–19 contain the Stage 2 Research GPS, grounded-writing, data-intelligence, scientific-auditor, reviewer-simulation and journal-advisor capabilities. Those modules have been ported into the active Research Factory structure and are surfaced through Research GPS, Writing Studio, Data & Methods and Scientific Audit. PR #15's owner-controlled architecture brief is retained in `docs/research-factory-blueprint.md`. Merging those historical PRs directly would duplicate implementations and risk the IndexedDB adapter.

The correct integration is therefore a feature-parity integration, not a raw branch merge. Once this audit and the release verification are accepted, close PRs #15, #18–30 as superseded and link them to the consolidated release PR.

## Capability mapping

| Earlier phase | Previous PR | Current implementation | Parity notes |
|---|---:|---|---|
| Phase 2 — Project Workspace | #21 | `ProjectManager.tsx`, `project-management.mjs`, `legacy-projects.ts` | Project creation/editing, question/objectives/methodology, status, milestones, literature, notes, attachments, archive/restore and permanent deletion use the existing local project store. |
| Phase 3 — Research Blueprint & Protocol | #22 | `ResearchBlueprintWorkspace.tsx`, `ProductionLineWorkspace.tsx`, `research-orchestration.mjs` | Blueprint completeness, owner approval, version invalidation, task dependencies and researcher-confirmed completion are active. |
| Phase 4 — Literature Discovery & Evidence | #23 | `LiteratureDiscovery.tsx`, `EvidenceWorkspace.tsx`, `EvidenceIntelligence.tsx`, `literature-discovery.mjs`, `evidence-appraisal.mjs` | Semantic Scholar discovery, DOI/title deduplication, BibTeX, claim/source traceability, protocol methods, study extraction and researcher-led appraisal are active. |
| Phase 5 — Data & Methods | #24 | `DataMethodsLab.tsx`, `DataAnalysisWorkspace.tsx`, `dataset-analysis.mjs`, `data-methods-worker.ts` | Local CSV/TSV parsing, bounded previews, variable profiles and transparent dataset summaries are active. |
| Phase 6 — Writing Studio | #25 | `WritingStudioWorkspace.tsx`, `Studio.tsx`, `writing-document.mjs`, `LocalPythonPanel.tsx` | Local manuscript editing, autosave/revision guards, WebLLM options, LaTeX/BibTeX, templates, notes/data import and optional local compute are active. |\n| Stage 2 — Research GPS and research intelligence | #18 | `ResearchGPSWorkspace.tsx`, `ResearchPlanEditor.tsx`, `research-intake.ts`, `writing-grounding.ts`, `writing-guidance.ts`, `research-analysis.ts`, `DataMethodsLab.tsx` | Five starting routes, persisted editable station plans, story arcs and milestones; source-linked writing context, section-level draft staging, claim/citation audits, design-aware analysis recommendations, study-specific compliance declarations and reproducible manifests are active. |\n| Stage 2 — Scientific Auditor, reviewer simulator and journal advisor | #19 | `ScientificAuditWorkspace.tsx`, `scientific-audit.mjs` | Traceable checks for evidence, citations, methods, analysis reproducibility and manuscript consistency; simulated reviewer perspectives and journal-fit assessment are active. Simulations are disclosed and journal metadata remains researcher-supplied. |

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

The final release line also verifies the new Research GPS route, Research GPS persistence and mobile layout. All three dependency audits report zero vulnerabilities.

## Remaining distinctions and honest limitations

- The old branches are not merged because their implementation is superseded, not because their features were discarded.
- Systematic Reviews, Scientific Audit, Publication, Collaboration and Settings are later phases already present on the Phase 14 release line.
- Limrun native iOS/Android acceptance remains unverified because the account currently has no credits. Playwright mobile viewport coverage is not represented as native-device testing.
- Supabase leaked-password protection is disabled according to Security Advisor. It requires a Supabase Auth administrator setting change and is not modified by this release branch.
- Collaboration membership currently uses existing account UUIDs; no email-invitation service is claimed. Collaboration detail refresh is manual because Realtime is not enabled for the current tables.

## Release decision

Use the consolidated release line as the sole release candidate. After the exact release commit passes staged Vercel route/API smoke tests, merge PR #31 to `main`, close superseded PRs #15 and #18–30 with a link to the consolidated release, and promote the exact verified deployment to `paper-eta-mauve.vercel.app`.
