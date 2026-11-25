# PaperOrchestra — Research Factory Product & Architecture Blueprint

**Status:** Proposed architecture baseline  
**Scope:** Product redesign and implementation contract for the next development cycle  
**Guiding principle:** Automate the work, not the scientific authority.

## 1. Product definition

PaperOrchestra is an owner-controlled, AI-assisted research production environment. It guides a researcher from an idea, literature need, dataset, or existing manuscript to a defensible research package through coordinated specialist stations.

The manufacturing analogy is an operating model, not a claim that research is mechanically deterministic. Each station transforms research inputs into traceable outputs. Quality gates inspect those outputs. The researcher owns the research question, scientific judgement, approvals, authorship, ethics decisions, interpretation, conclusions, and submission authorization.

**Product promise:** A beginner always knows the next useful action. An expert can inspect, override, reproduce, and control every important operation.

## 2. Product principles

1. **One project, one source of truth.** All stations operate on a shared, versioned Research Blueprint. No disconnected module-specific copies.
2. **Progressive disclosure.** Guided mode is the default; Professional mode reveals methods, provenance, scripts, parameters, agent traces, and advanced configuration without forking project data.
3. **Multiple entry points.** Start with an idea, a literature question, a dataset, a systematic review, a case report, a conference paper, or an existing manuscript.
4. **Adaptive routing.** The assembly line is a recommended route, not a rigid gate. Existing work can enter at the relevant station and skip completed work after inspection.
5. **Human authority.** AI proposes and prepares. Deterministic tools execute bounded operations. Researcher-controlled scientific decisions require explicit owner action.
6. **Evidence before prose.** Claims and citations must be grounded in traceable sources, datasets, calculations, or clearly labeled researcher input.
7. **Quality is component-level.** A project-level progress indicator must never hide a failed, missing, stale, or unverified component.
8. **Reproducibility by design.** Preserve source files, dataset fingerprints, transformations, analysis scripts, software versions, assumptions, outputs, and execution records.
9. **Local-first and private by default.** IndexedDB remains the default source of truth. Supabase collaboration remains explicit, optional, and RLS-protected.
10. **No fabricated certainty.** Journal metrics, acceptance rates, review speed, APCs, plagiarism results, evidence support, and compliance statuses must show provenance, date, and uncertainty—or be labeled unavailable.

## 3. Research Factory operating model

### 3.1 Roles

- **Researcher / Factory owner:** sets direction, owns the project, approves decisions, and authorizes final outputs.
- **Research Orchestrator / Production manager:** schedules eligible tasks, checks dependencies, routes outputs, monitors station queues, and requests approvals. It cannot approve on behalf of the owner.
- **Specialist agents / Station operators:** perform narrowly scoped work under explicit contracts.
- **Independent inspectors:** review outputs without being the same agent that produced them.
- **Deterministic services / Machinery:** execute repeatable calculations, file transformations, citation formatting, validation, and compilation within bounded rules.

### 3.2 Station map

| Station | Responsibility | Primary outputs | Specialist roles |
|---|---|---|---|
| 00. Research Order | Plain-language intake, intended contribution, audience, data/source availability, paper type | Research brief, candidate questions, owner-confirmed objectives | Intake / Outline Agent |
| 01. Planning & Protocol | Scope, question framework, objectives, design, protocol, milestones | Versioned protocol, design rationale, decision register | Research Planner, Methods Advisor |
| 02. Literature Procurement | Search strategy, source discovery, retrieval, deduplication | Search log, source records, query history, deduplication report | Literature Agent |
| 03. Evidence Processing | Screening support, extraction, passage mapping, evidence synthesis | Screening recommendations, extraction records, evidence matrix, claim-source links | Evidence Agent, Citation Agent |
| 04. Methods & Compliance Design | Study design, variables, sampling, analysis plan, ethics/reporting checklist | Methods specification, variable dictionary, compliance plan | Methods Agent, Compliance Agent |
| 05. Data & Analysis | Data profiling, cleaning proposals, statistical guidance, scripts, charts and tables | Immutable raw-data reference, derived datasets, analysis runs, figures, tables | Data/Stats Agent, Figure Agent |
| 06. Manuscript Assembly | Build sections from approved protocol, evidence, analyses and owner notes | Structured manuscript sections, references, figure/table placements | Writing Agent, Clarity Agent |
| 07. Scientific Quality Control | Verify claims, references, calculations, consistency, reporting and reproducibility | Findings, issue register, verification map, release checklist | Independent Scientific Auditor |
| 08. Peer Review & Robustness | Simulated reviewer critiques, sensitivity checks, response planning | Reviewer reports, prioritized fix cards, revision plan | Reviewer #2 Agent, Robustness Agent |
| 09. Publication Preparation | Journal fit research, format compilation, submission package | Journal shortlist, formatted manuscript, cover letter, supplements | Journal Intelligence, Formatting Compiler |
| 10. Revisions & Post-submission | Import reviewer/editor comments, response drafting, change tracking | Point-by-point rebuttal, revision diff, response matrix | Rebuttal Coach, Revision Tracker |

Stations may be re-entered after changes. A protocol change can invalidate downstream analyses and manuscript claims; the system must mark affected components stale and route them for reinspection.

### 3.3 Paper-type blueprints

At intake, offer a concise choice with plain-language explanations:

- Empirical study
- Systematic review
- Scoping review
- Case report / case series
- Conference paper / abstract
- Research proposal / protocol
- Existing manuscript improvement
- Dataset-first analysis
- Other / custom

Each blueprint defines required and optional sections, relevant reporting standards, expected inputs, recommended station route, and quality checks. It is a template, not an automatic declaration of compliance. Examples include PRISMA for relevant reviews, CONSORT for randomized trials, STROBE for observational studies, CARE for case reports, and ARRIVE for relevant animal research.

## 4. Beginner onboarding — Research GPS

### 4.1 Intake conversation

Do not begin with a blank document or a long academic form. Ask a small sequence of plain-language questions, one at a time where possible:

- What problem or observation made you interested in this topic?
- What did you find, or what do you want to understand?
- Who could benefit from the answer?
- Do you already have data, papers, or a draft?
- What kind of research output are you trying to produce?
- Is there a deadline, institution, funder, or journal requirement?

Allow "I don't know yet" and explain terms inline. The system can propose a research story arc and candidate questions, but the owner must confirm the research question and objectives.

### 4.2 Guided production plan

After intake, show:
- A plain-language summary of the project.
- Suggested paper-type blueprint and why it fits.
- Recommended station sequence with optional routes.
- What is already available and what is missing.
- The next single recommended action.
- Decisions that require owner approval.

### 4.3 Beginner and Professional modes

**Guided mode:** simple language, short tasks, examples, sentence starters, contextual explanations, safe defaults, and one primary next action.

**Professional mode:** full protocol fields, search syntax, inclusion/exclusion criteria, extraction schema, statistical scripts, model settings, API/provider controls, LaTeX options, provenance graph, and agent execution details.

Both modes edit the same canonical records. Switching modes must not duplicate, discard, or reinterpret project data.

## 5. Shared Research Blueprint (canonical project state)

The Research Blueprint is a normalized, versioned domain model. It must not become one giant JSON manuscript blob.

### 5.1 Core entities

- Project, ResearchBrief, ResearchQuestion, Objective, Hypothesis
- PaperTypeBlueprint, Protocol, ProtocolVersion, ProtocolDecision
- Station, StationRun, Task, TaskDependency, QualityGate, QualityFinding
- Agent, AgentRun, AgentPermission, ApprovalRequest, OwnerDecision
- SearchStrategy, SearchRun, Source, SourceVersion, SourcePassage
- ScreeningRecord, ExtractionRecord, EvidenceItem, Claim, ClaimEvidenceLink
- Dataset, DatasetVersion, Variable, Transformation, AnalysisPlan, AnalysisRun
- Script, SoftwareEnvironment, Figure, Table, Result
- Manuscript, ManuscriptVersion, Section, Paragraph, Citation
- ReportingChecklist, EthicsRecord, Journal, JournalAssessment
- ReviewerReport, ReviewerComment, FixCard, RebuttalItem
- ExportPackage, SubmissionRecord, AuditEvent

### 5.2 Required relationships and traceability

- A claim links to one or more source passages, dataset results, calculations, or owner-authored rationale.
- A citation links to a source record and, when available, exact page/section/passage.
- An analysis run links to exact dataset version, transformation sequence, script, environment, parameters, and outputs.
- A figure/table links to the analysis run and data from which it was produced.
- A manuscript paragraph links to claims, evidence, results, citations, and owner edits.
- A protocol version links to the decisions that approved it.
- A quality finding links to the exact component and location it concerns.
- An owner decision records the proposal, evidence, decision, rationale, actor, timestamp, and affected components.

Every important entity should have a stable ID, created/updated timestamps, provenance, version, and lifecycle status. Preserve original source files and raw datasets; transformations create derived versions rather than silently overwriting originals.

### 5.3 Change impact graph

When an upstream component changes, compute affected descendants. Examples:
- A changed inclusion criterion can stale screening decisions and evidence synthesis.
- A corrected dataset can stale analysis runs, figures, results, and manuscript paragraphs.
- A corrected source record can stale citations and claims that depend on it.
- An approved protocol amendment can require reinspection of downstream methods and reporting.

Mark affected components **Needs review / Stale**. Do not silently rewrite downstream approved work. The owner sees the impact list and chooses whether to rerun, revise, or accept a documented exception.

## 6. Agent orchestration and contracts

### 6.1 Agent contract

Every agent must declare:
- Unique role and version.
- Purpose and allowed station(s).
- Accepted input entity types and required fields.
- Output schema and provenance requirements.
- Read/write permissions and prohibited actions.
- Tools and data sources it may use.
- Whether it can execute autonomously, propose changes, or only analyze.
- Quality criteria and failure behavior.
- Model/provider and execution metadata.
- Human approval requirements.

Agents return structured artifacts, not only conversational text. Each run records input references, output references, tool calls, source provenance, model/provider version where available, token/cost metadata where available, timestamps, errors, and status.

### 6.2 Initial specialist roster

- Intake / Outline Agent
- Research Planner
- Literature Search Agent
- Source Verification Agent
- Screening Assistant (recommendation only)
- Evidence Extraction Agent (draft extraction only)
- Methods Advisor
- Data Profiling Agent
- Statistical Advisor
- Figure & Table Agent
- Writing Agent
- Plain-language / Academic Clarity Agent
- Citation and Claim Verification Agent
- Reporting / Ethics Checklist Agent
- Independent Scientific Auditor
- Reviewer #2 Agent
- Journal Intelligence Agent
- Formatting Compiler
- Rebuttal Coach

Avoid creating an agent for every button. Use deterministic services for predictable operations and specialized agents only where reasoning adds value.

### 6.3 Orchestrator rules

- Route tasks only when dependencies and permissions allow.
- Use idempotency keys and bounded retries.
- Avoid duplicate runs and uncontrolled agent loops.
- Enforce per-project and per-user budgets, timeouts, cancellation, and concurrency limits.
- Pause when an owner decision is required.
- Preserve agent output even when it fails inspection, with clear failure reason and retry route.
- Keep independent inspection separate from production agent identity.
- Treat uploaded documents, retrieved webpages, PDFs, datasets, and agent tool outputs as untrusted data, never as instructions that override system or owner policy.

## 7. Authority and permission model

| Class | Examples | Default behavior |
|---|---|---|
| A. Deterministic autonomous | DOI normalization, deduplication suggestions, word counts, formatting, schema validation, reproducible calculations | Execute within explicit bounds; log results |
| B. AI-assisted preparation | Search expansion, draft screening recommendation, draft extraction, outline, writing suggestions, statistical test recommendations, reviewer simulation | Prepare proposals with provenance; owner can inspect |
| C. Explicit owner approval | Final inclusion/exclusion, protocol amendment, methods selection, cleaning decisions that alter data, analysis selection, interpretation, major claim changes, final manuscript approval | Pause until owner approves |
| D. Owner-exclusive | Research question ownership, ethics declarations/decisions, authorship, conflicts of interest, final conclusions, submission authorization, response acceptance | Never delegate authority to an agent |

No agent may:
- Approve its own work or its own quality gate.
- Convert a recommendation into a scientific decision without approval.
- Overwrite raw files or approved versions.
- Hide contradictory evidence or delete dissenting findings.
- Invent ethics approval, consent, authorship, source support, journal metrics, or research results.
- Submit or send a manuscript without explicit owner authorization.

Provide a global **Pause all agents** control, per-run cancellation, revoke permissions, and inspectable activity history.

## 8. Station quality gates and component status

Each station defines mandatory checks, optional recommendations, and human review requirements. Completion alone is not a pass.

### 8.1 Common gate states

- Not started
- Ready
- Running
- Awaiting owner
- Passed
- Passed with warnings
- Failed
- Blocked by dependency
- Stale / needs reinspection
- Skipped with documented reason

### 8.2 Evidence and claim verification statuses

- Verified source support
- Calculation / dataset support
- Partial support
- Unsupported
- Conflicting evidence
- Awaiting verification
- Not applicable

A source being relevant is not proof that it supports a specific claim. The verifier should show exact supporting passage, page/section, source version, and why the passage supports or fails to support the claim. Do not claim full plagiarism detection unless an authorized external comparison service is actually connected.

### 8.3 Example evidence station gate

Mandatory checks:
- Source is retrievable or its access limitation is documented.
- Bibliographic metadata has provenance.
- Extracted values are traceable to the original location.
- Missing values and uncertainty are explicit.
- Conflicting results are preserved.
- Screening/extraction recommendations remain distinguishable from owner decisions.

Failed mandatory checks return to the responsible station or request owner intervention.

## 9. Writing Co-pilot

### 9.1 Section-by-section assembly

Use paper-type blueprints to guide each section with micro-prompts. For example, an Introduction may guide the author through:
1. Broad context.
2. What is already known.
3. What remains uncertain or is the knowledge gap.
4. Why the gap matters.
5. Study objective / question.

For each block show its purpose, plain-language explanation, recommended length range where supported by the selected blueprint, sentence starters, relevant evidence, and completion checks.

### 9.2 Grounded writing

- Suggestions must use the project’s source library, approved protocol, owner notes, and verified analysis outputs.
- Show linked evidence beside generated paragraphs.
- Flag unsupported factual statements and missing citations.
- Distinguish sourced facts, owner-supplied information, analysis results, and AI-generated connective prose.
- Never fabricate citations or imply a PDF was read when only metadata was available.
- Preserve the author's meaning and voice; allow plain-language drafting followed by an academic clarity pass.
- Keep edits reviewable with before/after diffs and accept/reject controls.

## 10. Data, statistics and visualization station

Beginner path:
1. Upload or select a dataset.
2. Show a data dictionary and simple profile.
3. Explain possible analysis approaches in plain language.
4. Ask for owner confirmation of research design and variables.
5. Propose statistical tests and explain assumptions.
6. Run only after approval where analysis choice affects scientific interpretation.
7. Produce tables, figures, captions and reproducible reports.

Professional path exposes scripts, formulas, parameters, diagnostics, missing-data strategy, assumptions, software versions, and execution logs.

Requirements:
- Preserve immutable raw dataset references and create derived versions.
- Fingerprint each dataset version.
- Record cleaning and transformation steps.
- Distinguish descriptive from inferential analysis.
- Surface assumption failures and missingness.
- Never choose a test solely from column types without study-design context.
- Captions must be generated from actual outputs and checked.
- Keep existing bounded local parsing/worker safeguards and compute service security limits.

## 11. Compliance, ethics and originality

Create a project-specific checklist selected from paper type and study design. It can include reporting guidelines (PRISMA, CONSORT, STROBE, CARE, ARRIVE and others as appropriate), ethics approval/waiver details, consent statements, trial registration, data availability, funding, conflicts, author contributions, and AI-use disclosure.

The system may detect missing statements and explain requirements. It must not invent approvals, registrations, consent, or declarations. Originality checks must clearly state the scope of the comparison and the connected service used. Similarity is not a legal or ethical verdict.

## 12. Peer-review simulator and fix cards

Reviewer agents should challenge the work using the selected paper type, reporting checklist, journal instructions when verified, and relevant methods context.

Each critique becomes a fix card containing:
- Severity and priority.
- Critique category (methods, evidence, logic, statistics, reporting, clarity, figures, ethics, references).
- Exact manuscript location or component.
- Explanation and evidence.
- Suggested correction, clearly marked as a suggestion.
- Dependencies and affected components.
- Status: open, owner reviewing, accepted, rejected, fixed, recheck required.

Do not label an AI simulation as a real peer review or predict acceptance. Provide multiple reviewer perspectives when useful and preserve disagreement.

## 13. Journal fit and submission compiler

Journal intelligence may rank candidate journals by verified scope match, article type fit, indexing status, publisher legitimacy, publication model, APC, submission requirements, and review-time information where reliably published.

For every field record source, retrieval date, and confidence. Acceptance rates and review times are often unavailable or incomparable; show **not publicly verified** rather than inventing estimates. Predatory-risk signals should be explainable and presented as risk indicators, not unsupported definitive accusations.

Formatting compiler:
- Use verified journal author instructions and templates.
- Compile Word/LaTeX output, figures, tables, supplementary files, and cover letter.
- Preserve a neutral canonical manuscript separate from journal-specific formatted copies.
- Validate required files and formatting; report unsupported instructions rather than guessing.
- Never submit automatically. Owner previews and explicitly authorizes the final package.

## 14. Rebuttal and revision autopilot

Import reviewer/editor comments and preserve the original text. Group comments by topic, severity, and required action. Draft point-by-point responses with respectful tone, link each response to exact manuscript changes, and track before/after versions. The owner approves every scientific response and final resubmission package.

## 15. User experience and navigation

### 15.1 Main navigation

- **Research Station** — production control room and next action.
- **Projects** — all research projects and templates.
- **Discover** — literature search and source library.
- **Research Factory** — station map, queue, dependencies and runs.
- **Analyze** — Data & Methods workspace.
- **Write** — guided manuscript assembly.
- **Inspect** — evidence verification, scientific QA and peer-review.
- **Publish** — journal fit, formatting, submission and rebuttal.
- **Settings** — guided/professional mode, models, providers, local engine, collaboration and privacy.

Existing modules remain available as station workspaces and should be migrated incrementally.

### 15.2 Research Station dashboard

Show:
- Current project and paper type.
- Production line with station status.
- One clear recommended next action.
- Owner approval queue.
- Failed/stale quality findings.
- Agent activity and pause control.
- Recent decisions and version changes.
- Research package preview.

Never invent progress percentages. Derive status from actual station tasks, component readiness and quality gates. If a summary score is introduced, expose its formula and underlying components.

### 15.3 Station screen pattern

Every station follows a consistent layout:
- **Purpose:** what this station does in plain language.
- **Inputs:** what it needs and where the inputs came from.
- **Work area:** simple guided workflow by default.
- **Agent panel:** what agents can do, current run, outputs and permissions.
- **Quality gate:** checks, warnings and blockers.
- **Owner decisions:** approve, reject, edit, defer.
- **Advanced drawer:** methods, parameters, scripts, prompts and technical details.
- **Traceability:** upstream inputs and downstream dependencies.

### 15.4 Owner approval centre

A dedicated inbox for protocol decisions, screening decisions, extraction corrections, analysis plans, manuscript changes, quality exceptions, and submission authorization. Each item must show consequences and affected components. Bulk approval is allowed only for clearly homogeneous low-risk items with a transparent review preview; never bulk-approve scientific decisions by default.

## 16. Technical architecture and migration constraints

### 16.1 Logical layers

1. Experience layer: responsive PWA, Guided/Professional mode, station workspaces.
2. Orchestration layer: task scheduler, dependency graph, permissions, budgets, retries, approvals.
3. Research domain layer: normalized Research Blueprint and versioned entities.
4. Agent/tool layer: specialist agent contracts, deterministic tools, provider adapters.
5. Scientific compute layer: browser WebLLM, bounded local/remote Python and TeX services.
6. Persistence layer: IndexedDB first; optional Supabase collaboration with RLS and explicit sharing.
7. Provenance/audit layer: source lineage, version graph, decisions, run logs and change impact.

### 16.2 Preserve current infrastructure

- React 19 + Vite PWA and installed Lumen React adapter version remain the frontend baseline.
- IndexedDB remains default local source of truth.
- Supabase remains optional, opt-in, and protected by RLS.
- Browser WebLLM inference remains lazy-loaded and browser-local.
- Existing local/remote compute boundaries, rate limits, file limits, export sanitization, formula neutralization, and LaTeX protections remain.
- Semantic Scholar cooldown/cache behavior remains.
- Existing Systematic Review researcher-led decisions remain authoritative.
- Do not introduce a server-side autonomous LLM that silently changes research data.

### 16.3 Migration approach

1. Inventory current IndexedDB stores, schemas, project identity, and module state.
2. Map existing records to canonical entities without destructive conversion.
3. Add additive, versioned migrations and rollback/recovery strategy.
4. Preserve legacy readers until migrated projects pass integrity checks.
5. Provide migration preview and backup/export before schema changes.
6. Keep local projects local; do not upload during migration.
7. Add cloud sync only for explicitly shared projects and verify RLS authorization.
8. Test old project fixtures, missing/partial records, interrupted migrations, duplicate retries and conflict recovery.

## 17. Security, privacy and safety requirements

- Enforce authorization server-side and with Supabase RLS; UI visibility is not authorization.
- Never expose service-role keys, compute tokens, or provider secrets to browser code.
- Apply per-user/project quotas, request budgets, timeouts, concurrency controls and file limits.
- Treat PDFs, web pages, datasets and generated text as untrusted content; defend against prompt injection and unsafe document instructions.
- Do not execute arbitrary uploaded code automatically.
- Keep compute services isolated and bounded; do not treat a shared Railway process as a complete sandbox for arbitrary code.
- Record consent and explicit sharing actions.
- Provide export, delete and local-only controls consistent with data ownership.
- Maintain audit events for agent actions and owner decisions.

## 18. Delivery roadmap

### Foundation and product architecture
- **Phase 11:** finalize domain model, state machine, permissions, agent contracts, event/provenance model, migration design and acceptance criteria.
- **Phase 12:** Research Station dashboard, assembly-line navigation, station shell, Guided/Professional toggle and owner approval centre shell.

### Production workflows
- **Phase 13:** Research GPS onboarding and paper-type blueprints.
- **Phase 14:** station orchestration, task dependencies, quality gates, run history and pause/cancel controls.
- **Phase 15:** evidence graph, claim-to-source verification and grounded Writing Co-pilot.
- **Phase 16:** Data & Methods production workflow, reproducibility records and figure/table generation.
- **Phase 17:** scientific auditor, compliance checks and Reviewer #2 fix cards.
- **Phase 18:** journal intelligence, format compiler, rebuttal and revision workflow.

### Integration and release
- **Phase 19:** legacy module migration, offline/local-first regression, optional collaboration integration and security review.
- **Phase 20:** end-to-end production-line testing, independent review, accessibility/device validation, preview verification and controlled production release.

Phases should be sliced into reviewable PRs. Do not attempt a risky all-at-once rewrite.

## 19. Acceptance criteria

The architecture is considered implemented only when:

1. A new user can start with an idea, dataset, literature need, or manuscript and receive an understandable route.
2. A paper-type blueprint generates a transparent, editable station plan.
3. Guided and Professional modes operate on identical project records.
4. Every station has declared inputs, outputs, status, responsible agent/tool, quality gate, and owner decision rules.
5. Agents cannot perform owner-exclusive actions or approve their own outputs.
6. The owner can inspect, pause, cancel, revoke, approve, reject, and audit agent work.
7. Claims and citations link to traceable source passages or calculation/data outputs.
8. Changes propagate stale status to affected downstream components without silently overwriting approved work.
9. Data analysis is reproducible from recorded data version, transformations, script, environment and parameters.
10. Compliance and originality checks report their actual scope and never fabricate certification.
11. Peer-review critiques become actionable, locatable fix cards.
12. Journal intelligence distinguishes verified facts, estimates, and unavailable data.
13. Submission formatting creates a reviewable package and requires explicit owner authorization.
14. Existing projects and modules continue to work throughout additive migration.
15. Local-first behavior and explicit Supabase sharing/RLS remain intact.
16. Regression, type/build, security, browser, accessibility, responsive, mobile and production smoke checks pass on the exact release commit.

## 20. Non-goals and explicit limitations

- PaperOrchestra is not an autonomous scientist and does not guarantee scientific validity, publication, journal acceptance, or ethics compliance.
- AI-generated screening, extraction, methods, statistical advice, interpretation, writing, reviewer comments and journal recommendations are proposals until reviewed according to permission class.
- A similarity checker is not automatically a plagiarism verdict.
- A reporting checklist is not proof that a study is ethically or scientifically sound.
- Journal acceptance rates and review durations must not be invented when unavailable.
- The assembly line does not force every project through every station.

## 21. Product north star

**The researcher owns the vehicle. PaperOrchestra organizes the factory. AI agents perform bounded specialist work. Independent inspectors verify components. Every important decision is traceable and the researcher authorizes the finished research package.**
