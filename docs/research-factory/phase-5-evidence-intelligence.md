# Research Factory Phase 5 — Evidence Intelligence

## Objective

Migrate source-linked claim assessment and evidence passage management into the independent Research Factory. Protocol planning is already migrated in Phase 3.

## Capability parity

- Create researcher-authored claims with explicit awaiting-verification state.
- Build source options from saved project papers and existing source entities.
- Preserve exact quoted evidence passages and optional page/section locators.
- Link each passage to a source and a claim through the existing Research Relation store.
- Record researcher judgements: supports, partially supports, contradicts or irrelevant.
- Calculate visible claim-level evidence status and judgement counts.
- Surface conflicting evidence without hiding contradictions.
- Preserve provenance and versioned local persistence.
- Keep all judgement researcher-controlled; do not imply automated appraisal or causal certainty.

## Boundaries

- Reuse existing evidence-intelligence domain functions, Research Entity and Relation stores.
- Do not create duplicate evidence stores or move local records to Supabase.
- Do not fabricate quotations, citations or evidence ratings.
- Keep the legacy production frontend and production Vercel project untouched.

## Verification

- Browser tests for claim creation, source selection, passage capture, judgement, conflicting evidence and reload persistence.
- Existing evidence domain tests and full repository regression.
- Responsive, keyboard and WCAG 2.2 A/AA checks.
- Dependency audit and production build.
- Isolated Vercel preview only.
