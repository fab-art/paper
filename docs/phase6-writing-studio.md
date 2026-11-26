# Phase 6 — Writing Studio

## Purpose

Migrate the complete existing Writing Studio into the independent Research Factory while preserving its manuscript model, local AI runtime, project persistence and export workflow.

## Delivered capabilities

- Project-bound manuscript workspace backed by the existing PaperOrchestra IndexedDB project records.
- Autosaved LaTeX manuscript and BibTeX editing, using the existing revision and concurrent-write guards.
- Research outline, literature discovery, plotting, sequential section drafting and manuscript refinement agents.
- Local WebLLM runtime with Qwen2.5 3B, Phi-3.5 Mini and Llama 3.2 3B options, plus a configurable local OpenAI-compatible endpoint.
- Streaming generation, model loading progress and GPU/runtime status.
- Citation-key checks that identify references cited in the manuscript but missing from the BibTeX library.
- Generic Article, CVPR 2025 and ICLR 2025 template selection, with the official template assets migrated into the new app's public directory.
- LaTeX source and BibTeX editors, print/PDF preview, figure gallery and ZIP project export.
- Notes and CSV/JSON experiment-data import.
- Optional Windows Desktop Companion Python console with explicit confirmation before executing local scripts.

## Data integrity

The editor loads and saves the existing project record using the existing IndexedDB database and project revision/write guards. It does not create a second manuscript database. Autosave retains the legacy snapshot guard and serial save queue. A concurrent edit conflict is surfaced with a reload-latest action rather than silently overwriting another tab's changes.

The local model remains optional and is loaded only after the user requests it. The Python companion remains optional and scripts are run only after an explicit confirmation; the companion is not a sandbox.

## Known integration boundary

The writing UI and all project-local editing, autosave, local model and export capabilities are migrated. Search-paper and native LaTeX compilation still rely on the existing API/compute service configuration. When the compute service is not configured, the existing browser plot and print-preview fallbacks remain available where implemented. Deployment of root-level serverless APIs is a separate Vercel routing/infrastructure task and is not silently claimed by this phase.

## Verification

- Domain tests cover safe LaTeX section insertion/replacement, section labels, insertion before bibliography/document end, escaping and missing citation-key detection.
- Playwright tests cover the Writing Studio route, empty project state, console errors and narrow mobile layout.
- CI additionally runs strict TypeScript, all replacement-app unit tests, production build, dependency audit, browser/accessibility tests and the repository regression suite.

## Release boundary

This phase remains on `feat/independent-research-factory-rebuild`. It does not merge to `main` or deploy to production.
