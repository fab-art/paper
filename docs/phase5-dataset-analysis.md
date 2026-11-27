# Phase 5 — Dataset Analysis

## Purpose

Bring the legacy local-first Data & Methods Lab into the independent Research Factory without creating a second dataset store or changing the user's source files.

## Delivered

- A dedicated `/data` route and active Data & Methods navigation item.
- Project selector backed by the existing local project database.
- Dataset discovery from the selected project's existing attachments.
- CSV and TSV parsing in a Web Worker to keep the interface responsive.
- Existing parser safety controls retained: 250 columns, 100,000 preview rows, 500,000 retained cells and the existing 30 MB upload boundary.
- Variable profiling for numeric, date and text columns, including missingness, unique values and numeric min/max/mean/median.
- Dataset quality summary for missing cells, complete rows and duplicate rows in the retained preview.
- Searchable variable profiles and a read-only first-eight-row preview.
- Responsive, keyboard-accessible workspace presentation.

## Data integrity and limits

The workspace reads the attachment Blob from the existing IndexedDB-backed project library. It does not overwrite or transform the original attachment. Parsing and descriptive profiling run in the browser. If the parser retains only a bounded preview, profile and quality summaries describe that retained preview; the UI calls this out instead of implying that sample-based statistics are full-dataset inference.

The current release supports CSV and TSV only. It does not yet perform statistical inference, missing-value imputation, data transformation, hypothesis tests, regression, or export of cleaned datasets. Those capabilities require separately specified, reproducible analysis operations and provenance records.

## Verification

- Domain tests cover numeric/date/text classification, missingness, uniqueness, descriptive summaries, duplicates and empty previews.
- Playwright tests cover the route, local-first messaging, console errors and a narrow mobile viewport.
- CI additionally runs the replacement app typecheck, unit tests, production build, dependency audit, browser/accessibility tests and repository regression suite.

## Release boundary

This phase remains on `feat/independent-research-factory-rebuild`. It does not merge to `main`, modify the production app, or perform production-domain cutover.
