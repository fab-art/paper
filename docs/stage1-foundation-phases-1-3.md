# Stage 1 — Foundation: Phases 1–3

**Product model:** PaperOrchestra Research Factory  
**Design system:** Lumen UI React adapter, pinned at the installed 4.3.0 contract  
**Principle:** Automate preparation and repeatable work; preserve researcher authority over science.

This document is the implementation contract for the first three foundation phases. It deliberately keeps the foundation release cohesive: canonical research data, an executable workflow model, and the beginner/professional workspace that operates on that same data.

## Phase 1 — Research Blueprint and domain foundation

### Goal
Create one canonical, versioned research record without deleting or replacing the existing local-first Project model.

### Delivered domain records
- Research Blueprint: title, context, question, objectives, paper type, audience, available materials, story arc, lifecycle, mode, provenance and version.
- Research entities: question, objectives, methodology, sources, nested outline sections and systematic-review workspace.
- Research relationships: typed links between project entities.
- Research decisions: explicit owner decision record with rationale and decision provenance.
- Existing project migration: Dexie v1–v4 data is retained and backfilled into additive v5 stores; no legacy record is removed.
- New schema: Dexie v6 adds the production queue, approvals, owner controls and audit events.
- Compatibility: existing Project editing remains supported and mirrors only its explicitly owned fields into the canonical Blueprint. It does not overwrite canonical entity records, provenance or owner decisions.
- Concurrency: project revisions and blueprint versions are checked to prevent stale overwrites.

### Integrity rules
- Migration preserves duplicate source records; deduplication remains a separate reviewed action.
- Every migrated entity records legacy provenance; newly created entities record owner provenance.
- A relationship must connect two existing entities in the same project and cannot be a self-link.
- Owner decisions require an explicit owner-confirmation signal and are recorded as owner-decided.
- Local IndexedDB remains the default source of truth; migration does not upload local records to Supabase.

## Phase 2 — Research Production Line and orchestration foundation

### Goal
Represent research as connected stations that transform traceable inputs into outputs, with visible dependencies, queues and quality/approval states.

### Station route
1. Research order / intake
2. Planning and protocol
3. Literature discovery
4. Evidence processing
5. Methods and compliance
6. Data and analysis
7. Manuscript assembly
8. Scientific quality control
9. Peer-review simulation
10. Publication preparation
11. Revisions and response

Paper-type routes adapt this sequence. For example, a systematic review includes evidence processing but does not require the general dataset-analysis station by default. A dataset-first analysis prioritizes data profiling and analysis. Users can enter at an appropriate station after existing work is inspected.

### Task lifecycle
- Queued
- Running
- Awaiting owner
- Completed
- Failed
- Blocked
- Stale / needs re-check
- Canceled

Tasks support dependencies, station ownership, optional specialist assignment, input/output entity references, retry, cancellation, version checks and audit history. A task cannot start while its dependencies remain incomplete. Paused agent work produces no eligible queue items.

### Owner gates
- Approval before execution: a task starts in Awaiting owner and only moves to Queued after explicit owner approval.
- Approval after execution: agent output moves to Awaiting owner and cannot become Completed until the owner approves it.
- Request changes returns the task to the queue and preserves the decision rationale.
- Only the owner can pause/resume agents, approve output, request changes, retry or cancel work.
- Agents cannot approve their own output or another agent's work.

### Specialist contracts
The registry defines bounded roles for Research Planning, Methods, Literature, Evidence Extraction, Citation Verification, Compliance, Data/Statistics, Figure/Table creation, Writing, Clarity, Scientific Audit, Reviewer #2, Journal Fit, Formatting and Rebuttal.

The current execution adapter uses the already-installed local WebLLM engine. A researcher loads the model in Writing Studio, then can dispatch an assigned specialist task from the Production Line. The executor reads the canonical Blueprint and linked project entities, includes completed upstream task outputs, applies the specialist's permission contract, and saves the result as a proposed research-note entity with agent provenance. The task moves to Awaiting owner; the output cannot be accepted until the owner approves it. If no local model is loaded, the UI explains how to load one rather than pretending the agent ran. This adapter generates bounded drafts and recommendations; it does not claim to perform external database searches, run statistical analyses, verify full-text claims, compile journal packages or submit manuscripts unless a corresponding tool adapter actually performs that work.

Every role declares:
- allowed stations;
- readable inputs;
- proposed outputs and draft-write scope;
- prohibited actions;
- explicit `canApprove: false`.

Agent task transitions must identify the assigned specialist. An agent cannot impersonate a different specialist. The current queue records assignment and governs the task lifecycle; it does not claim a model executed a task unless a real runner produced an auditable result. Additional provider/tool adapters for literature retrieval, statistical execution, citation passage verification and journal compilation must follow the same contracts and record their actual tool provenance; those actions are not simulated.

## Phase 3 — Guided Research GPS and Professional workspace

### Beginner experience
Project creation asks plain-language questions:
- What problem or observation brought you here?
- What do you want to find out?
- What kind of research are you preparing?
- Who should care about the answer?
- What do you already have?

The intake creates a draft brief and a suggested story arc. It does not silently approve the research question, design or methods. Paper-type blueprints include empirical studies, systematic reviews, scoping reviews, case reports, conference papers, protocols, dataset-first work, existing manuscripts, other and undecided.

The Production Line view then presents:
- one recommended next station;
- a plain-language purpose for each station;
- expected outputs;
- a task composer with optional specialist assignment;
- owner approval actions;
- a visible pause/resume control.

### Professional experience
The same project data can be inspected in Professional mode, which reveals station outputs, agent contracts, task identifiers, versions, run counts and dependencies. Guided and Professional modes never create separate copies of the project.

### Researcher authority
The researcher remains the source of scientific authority. Agents can propose and draft; deterministic tools can execute bounded operations; the owner controls research questions, protocol approval, screening decisions, methods selection, data transformations that affect interpretation, conclusions, ethics declarations, authorship and final submission.

## Lumen UI design-system contract

The Lumen UI design plugin is a required design and UX reference for PaperOrchestra UI work. Its catalog and recipe tools were used to inspect the project-workspace composition, navigation, status, progress, task and dialog patterns, plus semantic color and spacing guidance.

### Version compatibility
- Installed adapter in the repository: `@santi020k/lumen-react@4.3.0`.
- Installed overrides: `@santi020k/lumen@4.3.0` and `@santi020k/lumen-core@4.3.0`.
- Connected Lumen catalog snapshot: React adapter 5.3.0.
- Compatibility check correctly reports a mismatch between the installed 4.3.0 packages and the 5.3.0 catalog.
- Therefore, this implementation does not copy unverified 5.3.0-only props, upgrade dependencies, or mount the Astro runtime in React.
- The UI uses the installed adapter's existing, already-integrated Button, Card, Badge and Progress primitives. Lumen catalog guidance informs the hierarchy, component choice, semantic status and interaction design; existing 4.3.0 usage remains the compatibility authority.

### Visual and interaction principles
- Premium, calm research-workstation styling; restrained color and clear information hierarchy.
- Lumen semantic roles for canvas, surface, muted surface, ink, muted ink, line, brand, success, warning and danger.
- One clear next action in Guided mode; dense metadata and control details are progressively disclosed in Professional mode.
- Status is expressed with text and shape, not color alone.
- Responsive station cards and task queue; no fixed-width station columns on small screens.
- Visible focus, labeled form controls, keyboard-operable actions, reduced-motion support and explicit loading/error/empty states.
- No decorative analytics or invented progress. Completion is computed only from persisted tasks.
- One border/radius owner per surface; use spacing roles consistently; avoid nested cards without a clear content reason.

## Validation and release gates

The same reviewed commit must pass:
1. Phase 1 migration, provenance, relation and owner-decision regression tests.
2. Phase 2 station routing, dependency, queue, pause, task transition and approval tests.
3. Phase 3 guided intake, paper-type mapping and UI interaction tests.
4. Root and frontend dependency audits.
5. TypeScript check and Vite production build.
6. Vercel Preview build and runtime smoke checks.
7. Browser interaction and responsive checks at mobile, tablet and desktop widths.
8. Accessibility checks for labels, focus, keyboard interaction, contrast and reduced motion.
9. Independent review of migration safety, task authorization and owner approval enforcement.

A green build does not authorize production release by itself. Merge and production promotion happen only after all required checks pass on the final commit.
