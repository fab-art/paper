# PaperOrchestra Agent Instructions

Before changing code, read `CONSTRAINTS.md` and the relevant phase specification.

## Required workflow

1. Inspect the existing implementation, tests, package scripts and recent changes before editing.
2. For behavior changes, use test-driven development: add a focused failing test, verify the failure, implement the smallest fix, then verify the test passes.
3. Run the complete relevant test suite, TypeScript check and production build before declaring work complete.
4. Review the final diff for regressions, security boundaries, skipped tests, suppressions, fake data and unfinished stubs.
5. Keep changes small enough to review. Prefer focused commits and descriptive messages.
6. Report exact commands run and their results. Never claim a check passed if it was not executed.
7. Do not deploy to Vercel production during active implementation. Deployment is a separate release decision after the agreed quality gates pass.

## Product and architecture invariants

- IndexedDB is the default local source of truth.
- Supabase collaboration is optional and explicit. Never upload local projects automatically.
- Enforce authorization with Supabase RLS, not merely frontend visibility.
- Keep browser WebLLM inference and existing local/remote compute boundaries intact.
- Preserve Semantic Scholar cooldown/cache behavior and API error feedback.
- Preserve bounded, local dataset parsing and worker limits.
- Preserve export sanitization, formula neutralization and LaTeX safeguards.
- Keep systematic-review screening, extraction and risk-of-bias decisions researcher-led.
- Never fabricate citations, evidence, project metrics, completion status or research results.

## Phase 9 UI rules

- Follow `docs/phase9-lumen-redesign.md`.
- Use the verified Lumen React public API for the installed package version. Do not guess component names, props or import paths.
- Keep domain logic and state in PaperOrchestra; use Lumen for presentation and accessible primitives.
- Use semantic landmarks, keyboard-operable controls, visible focus, meaningful labels and reduced-motion support.
- Do not wrap every section in a card. Preserve readable content density and responsive behavior.
- Test 320, 375, 560, 768, 1024, 1280 and 1440 CSS px.
- Do not claim full WCAG conformance from static checks alone.

## Testing and release

- Current blocking CI commands are documented in `CONSTRAINTS.md`.
- Browser automation, runtime accessibility, Lighthouse and Limrun evidence are required before the integrated Phase 9 release.
- Verify the exact commit in all release reports.
- Keep Vercel production deployment until after build, automated tests, independent review and device checks.
