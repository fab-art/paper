# Phase 8 — Systematic Review & Evidence Synthesis

## Purpose
Provide a project-linked workflow for moving from a curated literature library to a documented, reproducible evidence set. Phase 8 is local-first and uses researcher-entered decisions; it does not claim that automated screening or appraisal has been performed.

## Data ownership and persistence
- The review is stored under `Project.systematicReview` in the existing Dexie/IndexedDB project record.
- No additional database table or Supabase migration is required.
- Existing project papers are synchronized into the screening queue when the workspace opens.
- New papers are added as pending; existing screening decisions are preserved. If a paper's identity improves from a title-only key to a DOI key, screening, extraction and risk-of-bias records are migrated to the new canonical key rather than reset.
- Removing a paper from the library removes it from the current queue on the next synchronization. Export a review matrix before deleting a source if its screening history must be retained.
- The review is local to the browser until a future explicit collaboration-sync slice is delivered. Authentication alone does not synchronize it.

## Deduplication
- DOI values are normalized across DOI URLs, `doi:` prefixes, case and trailing punctuation.
- Titles are normalized using Unicode NFKC, case folding and punctuation/whitespace normalization.
- A record is considered a duplicate when either its normalized DOI or normalized title has already appeared.
- DOI and title aliases from duplicate records are retained during the current deduplication pass to avoid duplicate aliases reappearing later.
- The first encountered source remains the canonical record; duplicate source metadata is not silently merged.

## Screening model
Each unique paper has two explicit stages:
1. Title/abstract decision: pending, include, maybe, or exclude.
2. Full-text stage: retrieved/not retrieved and pending, include, or exclude decision.

The application does not infer eligibility. The reviewer records a decision and reason. A full-text decision can only be made after the full text is marked retrieved in the interface.

## PRISMA-style flow counts
Counts are calculated from the current project library and screening records:
- Identified: number of source records in the library before deduplication.
- Duplicates removed: number of records removed by DOI/title deduplication.
- Records after duplicates: unique records.
- Records screened / not screened: title/abstract decisions completed / pending.
- Records excluded: title/abstract exclusions.
- Reports sought: title/abstract include or maybe decisions.
- Reports not retrieved: reports sought without a retrieved full text.
- Reports assessed: reports sought with a retrieved full text.
- Full-text excluded: assessed reports excluded at full text.
- Studies included: assessed reports marked include.
- Awaiting full-text decision: retrieved full texts still pending.

These are working PRISMA-style counts, not a certified PRISMA 2020 diagram. The interface labels this limitation.

## Study extraction
For full-text included studies, users can record study design, setting, population, sample size, intervention/exposure, comparator, outcomes, effect estimates, limitations and funding/conflicts.

## Risk of bias
Users select an appraisal framework (JBI, RoB 2, ROBINS-I, QUADAS-2, Newcastle–Ottawa Scale or other/adapted), then define the domains and record a judgement and rationale for each. The tool does not generate or validate domain judgements.

## Exports
- Evidence matrix: CSV with source metadata, screening decisions, extraction fields and a summary risk-of-bias judgement. CSV cells are escaped for commas, quotes and line breaks.
- Review flow: JSON snapshot of calculated counts and export timestamp.

## Validation
- Node built-in tests cover DOI normalization, DOI/title deduplication including alias chains, preservation of screening decisions, PRISMA-style count arithmetic and CSV escaping.
- The main pull-request workflow runs the regression suite before TypeScript/Vite production build.
- Preview deployment and a fresh Codex review are required before merge.
- Multi-reviewer conflict resolution, full-text PDF parsing, automated screening/extraction, formal PRISMA diagram rendering and cloud synchronization remain out of scope for this slice.
