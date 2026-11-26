# Phase 13 — Scientific Audit and Publication

## Scientific Audit

The Scientific Audit station provides a researcher-led checklist across:
- Protocol and research question alignment
- Evidence provenance and study-selection traceability
- Extraction and critical appraisal completeness
- Data and analysis reproducibility
- Ethics, consent and governance
- Funding, conflicts, authorship and research integrity
- Manuscript and reference traceability

Every finding begins as not reviewed. A named reviewer records verified, needs attention or not applicable, with a note and timestamp. Sign-off is blocked until all findings are reviewed. The audit intentionally produces no scientific quality score and does not claim to certify a study.

## Publication

The Publication station stores journal and article metadata, title, abstract, keywords, authors, affiliations, ORCID identifiers, corresponding author, ethics/funding/conflict/data-availability statements and author contributions.

It checks metadata completeness against the local manuscript and BibTeX records, drafts a cover letter only from researcher-provided facts, and exports cover-letter text and submission metadata JSON. A versioned status history records draft, ready, submitted, revision, accepted and published milestones.

PaperOrchestra does not submit manuscripts to journals or represent metadata completeness as journal acceptance. Recording a submitted status requires explicit researcher confirmation that submission occurred on the journal's own platform.

## Data and safeguards

Both workspaces persist their records on the existing local project record using the project's revision guard. No new database schema, automatic cloud upload, remote AI decision or automatic scientific judgement is introduced.

## Verification

- Unit tests cover audit generation, review history, sign-off guard, publication readiness, explicit external submission confirmation and cover-letter content.
- Workspace route tests require Scientific Audit and Publication to be active under Publish.
- Vercel Preview typecheck, tests and production build are release gates.
- Limrun UI acceptance remains pending until organization credits/subscription are restored.
