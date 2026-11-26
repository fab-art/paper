# Phase 12 — Systematic Reviews

## Purpose

Promote the existing systematic-review engine into the Research Factory navigation without replacing its mature review logic or breaking existing local project records.

## Delivered workflow

- Select an active local research project and use its existing paper library.
- Maintain a review protocol: review type, PICO fields, study design, databases, search dates, inclusion/exclusion criteria and registration URL.
- Deduplicate imported literature records with DOI-first identity rules while retaining screening decisions across identifier aliases.
- Screen titles/abstracts and full texts with explicit include, exclude, maybe and pending states, reasons and timestamps.
- Track PRISMA-style flow counts from identified records through studies included.
- Extract study characteristics and evidence notes.
- Record researcher-led risk-of-bias judgements by domain.
- Export the evidence matrix as CSV.
- Persist review data within the existing IndexedDB-backed project record.

## Data and scientific safeguards

- Existing `frontend/src/lib/systematic-review.mjs` remains the single source of truth for deduplication, screening migration, PRISMA counts and evidence-matrix export.
- No automated AI decision is allowed to screen or include studies, make risk-of-bias judgements or determine review conclusions.
- Existing screening and extraction records are migrated and merged rather than discarded.
- Writes use the existing project revision guard. The workspace serializes rapid edits to avoid stale-revision conflicts.
- No project data is uploaded to Supabase or a remote model provider.

## Verification

- Unit coverage for DOI normalization, deduplication, screening migration, PRISMA flow and CSV export remains in `tests/systematic-review.test.mjs`.
- Workspace route test requires `/systematic-reviews` to be active.
- Vercel Preview typecheck, tests and production build are the release gates.
- Limrun Android interactive acceptance is pending restoration of organization credits/subscription.
