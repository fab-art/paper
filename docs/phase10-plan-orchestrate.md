# Phase 10 — Plan & Orchestrate

## Purpose

Deliver the two planning workspaces that connect the existing PaperOrchestra project lifecycle to its literature, evidence, dataset and manuscript tools:

1. **Research Blueprint** — a structured, versioned, researcher-approved plan for a project.
2. **Production Line** — a dependency-aware set of tasks and deliverables that moves the approved plan through the existing research stations.

This phase is an extension of the existing local project model, not a second project system.

## Research Blueprint

The blueprint is stored as `Project.researchBlueprint` in the existing IndexedDB project record. Existing projects are mapped into a draft blueprint without deleting or rewriting their original research question, objectives, methodology, paper type, audience or resource fields.

Fields include:
- Research title, type, primary question and intended audience.
- PICO, PECO, PICOT, SPIDER or custom question framework.
- Population, intervention/exposure, comparator, outcomes and timeframe.
- Specific objectives, methodology, study design and setting.
- Inclusion and exclusion criteria.
- Search sources/databases.
- Analysis plan, ethics/governance and feasibility/resources.
- Approval status, approval actor, timestamp, version and provenance.

A blueprint can be saved as a draft while incomplete. Approval is blocked until the title, research question, at least one objective, methodology or study design, inclusion criteria, exclusion criteria and analysis plan are present. Approval is an explicit researcher action. Any subsequent change to an approved blueprint returns it to draft and clears the previous approval metadata.

The form does not generate scientific claims, citations, sample-size calculations, ethics determinations or statistical methods. Those remain researcher decisions.

## Production Line

The production plan is stored as `Project.productionLine` in the same IndexedDB record. A first-use project gets seven linked default tasks:

1. Approve research blueprint.
2. Discover and curate literature.
3. Screen and appraise evidence.
4. Inspect and analyze datasets.
5. Draft the research manuscript.
6. Verify scientific and reporting quality.
7. Prepare the publication package.

Researchers can add custom tasks with a stage, due date and optional dependency. The workflow validates task IDs and dependencies, prevents self-dependency and prevents tasks from starting or completing before their dependencies are complete.

The first blueprint gate cannot be completed until the saved blueprint is researcher-approved. If that approval is withdrawn by editing the blueprint, downstream tasks become blocked again until the updated blueprint is approved. Task completion requires an explicit completion confirmation; the application does not execute external work on a user's behalf.

The current Production Line tracks workflow state. It does not yet invoke AI agents or execute literature searches, data analysis, manuscript generation or publication submissions automatically. Those existing capabilities remain available in their own workspaces and can be opened from the Research Factory navigation.

## Data and security boundaries

- IndexedDB remains the default source of truth.
- Both objects are stored inside the existing project record; no new IndexedDB database or schema migration is introduced.
- No local project or plan is uploaded to Supabase automatically.
- The existing Supabase collaboration schema is unchanged in this phase; sharing and sync behavior are not expanded here.
- No service-role or secret key is used by the browser.
- No autonomous AI agent is granted authority to approve protocols, change screening/appraisal judgments, or mark research deliverables complete.
- Existing Literature Discovery, Evidence Workspace, Data & Methods and Writing Studio records are not duplicated or migrated destructively.

## Verification

- Node tests cover legacy blueprint mapping, required-field validation, approval, re-approval after edits, default workflow stages, custom tasks, dependency validation, readiness gates, researcher-confirmed completion and progress arithmetic.
- Playwright covers a full local project journey: seed an existing IndexedDB project, create and approve a blueprint, complete the first production gate and start the next task.
- Playwright also checks narrow mobile layouts for both new routes.
- CI runs the replacement app typecheck, unit tests, production build, dependency audit, browser/responsive/accessibility tests and repository regression suite.
- The exact branch commit must be deployed to the Vercel Preview project before this phase is considered verified.

## Release boundary

Phase 10 is developed on `feat/phase10-plan-orchestrate`, as a draft pull request against `feat/independent-research-factory-rebuild`. It is not merged to the parent branch or `main`, and it is not deployed to production as part of implementation.
