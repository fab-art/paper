# Research Factory Phase 6 — Data & Methods Lab

## Objective

Migrate the local dataset inspection and descriptive profiling workflow into the independent Research Factory.

## Capability parity

- Discover CSV and TSV files already attached to the active project.
- Parse files in a Web Worker so large files do not block the interface.
- Enforce the 30 MB attachment cap, 250-column cap, 100,000-row preview cap and 500,000-cell memory budget.
- Handle quoted fields, escaped quotes, delimiters, blank values and uneven row lengths.
- Show row and variable counts, missingness, unique values, numeric ranges, means and medians.
- Provide a searchable variable profile and read-only first-eight-row preview.
- Clearly distinguish descriptive profiling from inferential statistics.
- Preserve all original file bytes and keep data local.

## Boundaries

- Reuse project attachment storage and safe parsing limits.
- Do not mutate uploaded datasets or silently impute missing values.
- Do not claim statistical inference or automated scientific validity.
- Do not upload local datasets to Supabase.
- Keep the legacy production frontend and production Vercel project untouched.

## Verification

- Parser unit tests for quotes, delimiters, missing cells and size limits.
- Browser tests for CSV/TSV upload, profiling, variable filtering and empty/error states.
- Responsive, keyboard and WCAG 2.2 A/AA checks.
- Existing repository regression, security, dependency audit and production build gates.
- Isolated Vercel preview only.
