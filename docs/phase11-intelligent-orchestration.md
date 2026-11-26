# Phase 11 — Intelligent Research Orchestration

## Purpose

Connect the Phase 10 Production Line to existing research workspaces through versioned task briefs and researcher-reviewed AI proposals. The orchestration layer is a workflow coordinator, not an autonomous scientist.

## Scope

- Resolve each Production Line stage to its existing workspace route.
- Prepare a bounded task brief only after the task has been explicitly started, its dependencies are complete, and the research blueprint is approved.
- Keep system guardrails separate from project/context data when constructing the local-agent prompt.
- Validate model output before it becomes a proposal. Evidence references must point to source identifiers supplied to the brief.
- Store AI output as an unapproved proposal with provenance and an append-only decision trail.
- Require an identified researcher to approve or reject a proposal.
- Apply approved deliverables to the task with optimistic task-version and approved-blueprint-version checks. Task versions advance whenever task state changes. A blueprint edit or withdrawn approval invalidates downstream proposals. Applying a proposal does not complete the task.
- Reject stale proposals, cross-task application, unknown evidence identifiers and repeated application.

## Scientific authority and privacy

- AI may prepare suggestions and draft deliverables; it cannot approve a blueprint, make screening or risk-of-bias judgments, decide ethics, alter evidence records, or mark tasks complete.
- The canonical local IndexedDB project remains the source of truth. No project content is uploaded to Supabase automatically.
- Context passed to the model is explicit and scoped to the task. Retrieved documents and project text are untrusted data, not instructions.
- Every proposal records its task, project and blueprint versions, source identifiers, researcher decision actor, timestamps and application event. A named researcher identity is required for approval, rejection and application.
- Citations and generated scientific content remain subject to researcher and publisher-source verification.

## Contract

The domain service exports:
- `getWorkspaceForResearchStage`
- `createResearchTaskBrief`
- `buildResearchAgentPrompt`
- `createResearchAgentProposal`
- `decideResearchAgentProposal`
- `applyApprovedResearchProposal`

The model adapter is deliberately separated from the proposal lifecycle. The workspace runs the existing browser-local WebLLM runtime and never sends project context to a remote model provider. The task context may include saved paper abstracts, study-extraction records, dataset file metadata (not raw rows), and a bounded manuscript excerpt. Retrieved text remains untrusted data.

## Verification

Node tests cover readiness gates, prompt separation, evidence-reference validation, approval/rejection, audit trail, optimistic version checks, idempotency and the invariant that proposal application never completes a task.

## Release boundary

Developed on `feat/phase11-intelligent-orchestration` from Phase 10. This phase must pass the replacement app typecheck, unit tests, production build, browser integration tests, accessibility/responsive checks and exact-commit Vercel Preview verification before merge or production release.
