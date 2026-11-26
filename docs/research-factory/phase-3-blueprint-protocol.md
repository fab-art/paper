# Research Factory Phase 3 — Research Blueprint and Protocol Builder

## Objective

Migrate the existing research-intake and protocol-planning capabilities into the independent Research Factory frontend while retaining the legacy domain model and local-first data.

## Capability parity

- Capture the research problem or observation, question, intended audience, available materials and paper type.
- Build and edit the research story arc and structured objectives.
- Read and write the versioned Research Blueprint in the existing IndexedDB stores.
- Preserve entity provenance and researcher ownership of decisions.
- Create and edit a structured protocol draft, including study design, setting, population, sample size, outcomes and analysis plan.
- Display protocol completeness and missing fields without presenting readiness as ethics approval or scientific validation.
- Require explicit researcher approval for protocol approval transitions.
- Preserve revision/version conflict protection and idempotent legacy migration.

## Boundaries

- Reuse the existing `researchBlueprints`, `researchEntities`, `researchDecisions` and protocol domain functions where applicable.
- Do not replace the existing IndexedDB database or schema.
- Do not silently deduplicate imported evidence or overwrite researcher decisions.
- Do not upload local project data to Supabase.
- Keep the legacy production frontend and production Vercel project untouched.
- Do not cut over the production domain until all research stations have passed capability-parity and release gates.

## Verification

1. Add or extend domain and repository contract tests before implementation.
2. Verify blueprint create/load/save, version conflicts, entity provenance and reload persistence.
3. Verify protocol readiness for complete and incomplete drafts.
4. Verify explicit owner approval and cancellation paths.
5. Run Playwright browser, responsive and accessibility checks.
6. Run the complete existing repository regression, security, typecheck and production build gates.
7. Deploy the phase branch to the isolated Vercel preview and verify direct routes.

This phase is intentionally stacked on Phase 2 and remains a draft until reviewed.
