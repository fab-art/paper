# Phase 9 — Lumen UI System-Wide Redesign

## Goal

Redesign every PaperOrchestra surface as one coherent research environment using the Lumen UI React design system. This is a cross-phase visual and interaction refactor, not a rewrite of research logic or storage.

The implementation target is the existing React 19 + Vite PWA. The verified published adapter is `@santi020k/lumen-react@4.3.0` (MIT; requires React >=19 and Node >=22.12.0). The connected Lumen MCP catalog reports `5.3.0`, so its newer contracts must not be applied to this consumer. The v4.3.0 package manifest, React source exports, component props and stylesheet entry were inspected at the upstream `v4.3.0` tag. Pin the adapter and its resolved dependencies in the frontend manifest and lockfile together, then run compatibility/type/build checks against the installed package.

## Product design direction

- **Character:** premium research workstation; calm, precise, editorial, content-led.
- **Visual language:** light-first academic workspace with optional dark theme, warm neutral canvas, restrained ink/blue accent, fine borders, compact but breathable density, subtle elevation only where it clarifies hierarchy.
- **Layout:** persistent desktop navigation, responsive compact/mobile navigation, contextual project header, clear page title and primary action.
- **Typography:** readable system sans for controls and navigation; deliberate heading scale; comfortable long-form reading width and line height.
- **Surfaces:** use opaque surfaces for dense tables, evidence and editors. Reserve glass for limited global chrome only when contrast and legibility remain strong.
- **Icons:** existing Lucide React icon system; no emoji as functional icons.
- **Accessibility:** semantic landmarks and headings, accessible names, keyboard-operable navigation and dialogs, visible focus, reduced-motion support, WCAG AA text contrast, and explicit loading/empty/error/success/disabled states.
- **Responsive:** verify at 320, 375, 560, 768, 1024, 1280 and 1440px. No page-level forced minimum widths; dense data tables may scroll inside a named region.

## Lumen component contract

Use the React adapter and its public exports, not Astro components or hand-built copies of primitives. Initial verified catalog choices:

- `Sidebar` for persistent application navigation.
- `Card` for distinct content surfaces; avoid wrapping every section in a card.
- `Button` for primary, secondary, quiet and destructive actions.
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsPanel` for related panels.
- `DataTable` for dense structured records with sorting/filtering needs.
- Use semantic token roles: `canvas`, `surface`, `surface-muted`, `surface-strong`, `ink`, `ink-soft`, `ink-muted`, `line`, `brand`, `brand-solid`, `brand-soft`, `accent`, `success`, `warning`, `danger`.

Before implementation, inspect each component's installed-version public exports/types and load the Lumen foundation and selected component styles once. Keep app state and domain logic in PaperOrchestra; Lumen owns presentation and accessible primitive behavior.

## Cross-phase information architecture

### Global shell
- App navigation: Research Station, Projects, Literature, Writing Studio, Data & Methods, Systematic Reviews, Quality & Export, Collaboration, Settings.
- Global command/search entry, local/cloud sync state, account menu and responsive navigation.
- Persistent project context when inside a project; clear breadcrumb/back path.

### Phase 1 — Research Station dashboard
- Editorial welcome and one clear create/open project action.
- Project search, filters, recent projects, archived projects and meaningful project status.
- Real counts derived from stored data only; no decorative or invented metrics.
- Empty, loading, no-results and storage-unavailable states.

### Phase 2 — Project workspace
- Project overview with research question, objectives, methodology and milestones.
- Consistent project sub-navigation and visible save/local status.
- Research library, notes, attachments and project activity.
- Archive, restore and permanent-delete flows remain distinct; destructive actions require clear confirmation.

### Phase 3 — Literature discovery
- Search-first layout with query, source, filters and recent searches.
- Readable result rows/cards with metadata, DOI/source links and save state.
- Clear provider cooldown / Retry-After feedback; preserve valid external-link validation.
- Duplicate and already-saved states remain explicit.

### Phase 4 — Writing Studio
- Focused editor workspace with agent stages, outline, literature, manuscript and refine views.
- Resizable explorer/editor/preview where supported; responsive stacked fallback.
- Model download/load progress, execution state, cancellation/disabled navigation rules, errors and local autosave status.
- Preserve browser WebLLM, endpoint fallback, Python plotting, LaTeX and PDF workflows.

### Phase 5 — Data & Methods Lab
- Dataset picker, local processing status, dataset summary and variable profiles.
- Dense preview tables with scoped horizontal scrolling and accessible table descriptions.
- Keep CSV/TSV parsing local, worker-based and bounded; preserve truncation warnings.
- Distinguish descriptive inspection from inferential analysis.

### Phase 6 — Quality & Submission
- Clear readiness summary, grouped structural findings and researcher confirmation checklist.
- Export actions grouped by primary package and secondary formats.
- Visible export progress, success and failure feedback.
- Retain the disclaimer that structural checks do not certify scientific validity or ethics.

### Phase 7 — Collaboration
- Sign-in/onboarding and account state.
- Project sharing, member roles, invitation lifecycle, sync/outbox state, conflict resolution, comments/activity and version history as each capability becomes available.
- Local-only mode must remain first-class when Supabase is not configured or a user chooses not to share.
- Never represent UI hiding as authorization; database RLS remains the security boundary.

### Phase 8 — Systematic Review & Evidence Synthesis
- Review overview and protocol as a clear step-based workflow.
- Screening queue with decision filters, rationale, duplicate counts and full-text tracking.
- Data extraction and risk-of-bias domains with explicit researcher-entered judgements.
- Evidence matrix and flow-data exports.
- Clearly label PRISMA-style values as working counts, not a certified PRISMA diagram.
- Keep manual decisions and IndexedDB persistence intact; do not introduce AI eligibility decisions.

## Implementation sequence

1. **Foundation:** install the React adapter, update lockfile, verify compatibility, establish semantic light/dark tokens, typography, focus, motion and spacing.
2. **Application shell:** responsive navigation, project context, page header, command/search and status surfaces.
3. **Dashboard + project workspace:** phases 1–2; validate navigation, search, create/archive/restore/delete and autosave.
4. **Discovery + Writing Studio:** phases 3–4; preserve rate-limit behavior, WebLLM and compute paths.
5. **Data + Quality:** phases 5–6; preserve worker bounds, exports and confirmation persistence.
6. **Collaboration:** phase 7; preserve opt-in cloud, local-only mode and RLS boundaries.
7. **Systematic Review:** phase 8; preserve review identity migration, decisions, counts and exports.
8. **Consolidation:** remove superseded styles only after all consumers migrate; verify no duplicate primitive systems or unused CSS.
9. **Release:** regression suite, typecheck, lint if configured, production build, Vercel Preview visual/functional review and independent code/security review.

## Non-regression requirements

- IndexedDB remains the default local source of truth; no automatic upload of local projects.
- Supabase remains optional and access control stays enforced by RLS.
- Preserve the existing project data model, migrations, IDs, save guards, tombstones and revision checks.
- Preserve Semantic Scholar cooldown and cache behavior.
- Preserve browser-local dataset parsing and file limits.
- Preserve WebLLM, local compute fallback, remote compute proxy protections and LaTeX safeguards.
- Preserve quality/export contents and spreadsheet formula neutralization.
- Preserve systematic-review decisions, DOI-safe deduplication, record migration and export sanitization.
- Do not invent analytics, completion percentages or evidence-quality scores.

## Verification matrix

| Surface | Functional regression | Visual/accessibility checks |
|---|---|---|
| Dashboard | create/open/search/archive/restore/delete | 320–1440px, focus, empty/no-results |
| Project workspace | autosave, library, notes, attachments, milestones | keyboard navigation, overflow, status clarity |
| Discovery | search, cooldown, save, deduplicate, recent history | result density, errors, external-link labels |
| Writing Studio | model load, agent run, autosave, plot, compile/export | editor resizing, keyboard, reduced motion |
| Data & Methods | CSV/TSV worker, bounds, profiles, preview | table labels, scroll region, busy/truncated states |
| Quality & Export | checks, confirmations, ZIP and individual downloads | progress, success/error, destructive distinctions |
| Collaboration | auth, local-only mode, role and sync boundaries | auth states, permission messaging, responsive dialogs |
| Systematic Review | protocol, decisions, extraction, bias, exports | screening keyboard paths, counts and rationale clarity |

## Phase 9 acceptance criteria

- Every Phase 1–8 surface uses one shared Lumen visual language and responsive shell.
- The Lumen React version and lockfile are pinned consistently; imports match the installed public contract.
- No research workflow, local-first behavior, security boundary or export behavior regresses.
- Keyboard and screen-reader paths work for primary workflows; visible focus and reduced motion are verified.
- All supported viewports pass; no unintended horizontal page overflow.
- Regression tests, TypeScript, production build and Vercel Preview pass on the same commit.
- Independent review findings are addressed before the redesign is merged.

## Current baseline and release blockers

- Existing app: React 19 + Vite 6, npm workspaces via root/frontend package manifests, Node 22.
- Lumen is not yet installed in the repository; the React catalog currently reports 5.3.0.
- Phase 8 GitHub Actions workflow passed for the inspected head, but the Vercel status is `build-rate-limit`; a READY preview for that exact head was not available.
- The earlier phase PRs are drafts and stacked. Do not merge them solely because GitHub reports `mergeable=true`; mergeability is not equivalent to passing CI, deployment, review or product acceptance.

## Implementation checkpoint — 25 November 2026

### Dashboard visual prototype

A responsive Research Station dashboard prototype has been built in the private MagicPath project **PaperOrchestra — Phase 9 Lumen Redesign**. It includes the proposed navigation structure, workspace overview, project library, responsive mobile navigation, search/filter states, and a create-project interaction. Its project records are explicitly marked as preview data; it is not connected to IndexedDB or Supabase.

Prototype: https://designs.magicpath.ai/v1/radiant-dawn-6040

### Lumen package compatibility gate

The Lumen UI catalog currently reports `@santi020k/lumen-react` version **5.3.0** and its component contracts. The public npm listing currently identifies **4.3.0** as the published version. The Lumen compatibility check confirms 5.3.0 matches the catalog and 4.3.0 does not. The MagicPath build environment also does not include `@santi020k/lumen-react` by default.

Therefore, do not copy the preview's temporary native presentation wrappers into the production app or install an unverified package version. Before the production migration, resolve the published React adapter version and peer dependencies, verify its package tarball and lockfile resolution, and run the compatibility check against the actual installed package. The preview is a layout/interaction reference, not proof of Lumen package integration.

### Engineering baseline

The new repository quality contract and CI workflow are in place. Commit `6ca4c673809e7e7d135ab3dd3cae512dbc6f5e75` passed root/frontend npm audits, the complete regression suite, and the TypeScript/production build on Node 22.


## Verified adapter decision — 25 November 2026

- Published React adapter: `@santi020k/lumen-react@4.3.0`, MIT.
- Peer requirement: React `>=19`; engine requirement: Node `>=22.12.0`. The repository's React 19 and Node 22.16 runtime satisfy these requirements.
- Public v4.3.0 source confirms exports for `Button`, `Sidebar`, `Tabs`, `Badge`, `Card`, `Progress`, `Input`, `Label`, and the shared stylesheet at `@santi020k/lumen-react/styles.css`.
- The React adapter depends on matching `@santi020k/lumen` and `@santi020k/lumen-core` 4.3.0, plus `@tanstack/react-table` and `uqr`. Verify the complete resolved tree and lockfile; do not add only the top-level adapter.
- The connected catalog reports 5.3.0 and is therefore not a source of compatible v4.3.0 prop contracts. Use the upstream v4.3.0 public source/types for implementation until the catalog exposes a matching release.
- The current dashboard implementation is already backed by IndexedDB and includes project creation, opening, search, archive, restore, permanent deletion, real progress values and an opt-in Supabase sign-in panel. The visual prototype's illustrative data must not replace these operations.
- The current global stylesheet contains desktop-only constraints (`body { min-width: 900px; overflow: hidden }`) for the original research workspace. Phase 9 must scope layout behavior by shell/page and verify narrow viewport behavior rather than applying a blanket global override.

### Implementation order after this verification

1. Pin/install the adapter and all transitive dependencies using npm, update the committed frontend lockfile, and verify with `npm ci`.
2. Introduce the shared Lumen foundation and semantic tokens without breaking the existing project workspace.
3. Replace the dashboard's presentation while retaining its current IndexedDB, archive/restore/delete and auth behavior.
4. Add a shared responsive shell and migrate one page family at a time, each with regression coverage.
