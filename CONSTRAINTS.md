# PaperOrchestra Engineering Constraints

Last reviewed: 2026-11-25
Applies to: all branches, phases, contributors and coding agents.

This file is the canonical definition of what is allowed to pass review. Do not weaken a constraint merely to make a change pass. Any proposed change to this file must explain the reason and be reviewed independently from the feature it affects.

## 1. Always-enforced floor

- No secrets, access tokens, service-role keys, private credentials or personal data in source, tests, fixtures, logs or screenshots.
- No new TypeScript or lint suppressions (including `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, or equivalent) without a narrowly scoped explanation and expiry recorded in the Exceptions table.
- Do not add skipped, focused or deleted tests to make CI green. Any intentionally skipped test needs a linked issue, reason and expiry.
- No empty catch blocks or swallowed failures. User-visible workflows must surface actionable errors.
- No unfinished production stubs, placeholder success responses or fake data presented as real research evidence.
- Do not weaken existing validation, file-size limits, rate limits, RLS policies, export sanitization or local-first safeguards to satisfy a test.
- Do not automatically upload local projects to Supabase. Cloud sharing must remain explicit and opt-in.
- Do not use UI hiding as authorization. Supabase Row Level Security remains the access-control boundary.
- Preserve human control of research screening, extraction, risk-of-bias decisions and scientific interpretation.
- A change is not complete until its relevant tests have been run and the full repository regression suite has been checked.

## 2. Blocking checks currently enforced in CI

| Dimension | Required result | Command / evidence | When |
|---|---|---|---|
| Regression | All existing Node regression tests pass | `npm run test:regression` | Pull request and protected branch push |
| TypeScript + production build | Zero TypeScript/build errors | `npm --prefix frontend run build` (includes `tsc -b`) | Pull request and protected branch push |
| Dependency security | No npm audit findings at high or critical severity | `npm audit --audit-level=high` and `npm --prefix frontend audit --audit-level=high` | Pull request and protected branch push |
| Accessibility regression | All existing static accessibility regression assertions pass | Included in `npm run test:regression` | Pull request and protected branch push |

CI must use the Node version declared by the repository (Node 22.x), install from committed lockfiles with `npm ci`, and run with read-only repository permissions unless a job has a documented need for more.

## 3. Required release checks

These checks become mandatory before the integrated Phase 9 release. They are not represented as already automated until their tooling and test scripts are committed and verified.

| Dimension | Release requirement | Evidence |
|---|---|---|
| Browser workflows | Critical user journeys pass on a clean local production build | Playwright report and screenshots |
| Accessibility | Zero critical or serious axe violations on primary workflows; keyboard and screen-reader paths manually reviewed | axe report plus manual checklist |
| Responsive behavior | No unintended page-level horizontal overflow at 320, 375, 560, 768, 1024, 1280 and 1440 CSS px | Browser viewport screenshots / Playwright assertions |
| Mobile browser | Dashboard, project open/create, navigation, and key research workflows smoke-tested on iOS Safari and Android Chrome | Limrun run notes and screenshots |
| Performance | Record Lighthouse mobile and desktop baselines; target LCP <= 2.5 s and CLS <= 0.1 on representative routes | Lighthouse JSON reports |
| Security | Review auth, RLS, secret handling, upload limits, API rate limits, export sanitization and dependency findings | Security review checklist |
| Local-first | Core workflows continue without Supabase configuration or network access where applicable; local records remain in IndexedDB | Functional regression evidence |
| Production | Production smoke tests pass after an approved release deployment | Deployment URL, commit SHA and smoke-test report |

Performance targets are initial targets, not claims about current performance. If a route cannot meet a target because of a documented third-party or hardware constraint, record the measured value, cause, mitigation and owner rather than silently lowering the target.

## 4. Baselines and ratchets

Do not invent a coverage percentage, bundle-size budget or current Lighthouse score.

- Coverage: not yet measured. Establish a baseline when coverage instrumentation is introduced. Until then, every behavior change must add or update focused tests and must not remove existing assertions.
- Bundle size: not yet baselined. Capture production bundle output before enforcing a numeric budget.
- Lighthouse: not yet baselined. Capture mobile and desktop reports for the dashboard and one representative project workflow before enforcing regression budgets.
- Accessibility: existing static regression tests are active. Runtime axe coverage is a release requirement to be automated in the Phase 9 testing work.
- Dependency security: high and critical npm audit findings block CI. Lower-severity findings must be reviewed and tracked.

Once measured, a baseline may only move in the improving direction unless a documented, reviewed exception is approved.

## 5. Change review guardrails

Review every diff for:

1. Thresholds weakened, checks removed or workflow triggers narrowed.
2. Tests skipped, deleted, or assertions weakened.
3. New suppressions or ignored security findings.
4. Empty catches, fake success, placeholder implementations or unresolved TODOs in production paths.
5. New dependencies without a clear need, license review and lockfile update.
6. Changes to IndexedDB schemas, migrations, project identity, tombstones or revision checks without migration/regression coverage.
7. Changes to Supabase policies or sharing flows without RLS and authorization review.
8. Any UI-only change that accidentally changes research data, workflow state or business rules.

## 6. Exceptions

No active exceptions are approved.

| ID | Constraint | Path / scope | Reason | Owner | Expires |
|---|---|---|---|---|---|
| — | — | — | No exceptions recorded | — | — |

## 7. Release decision

A release candidate is eligible for Vercel production deployment only when:

- Blocking CI checks pass on the exact commit to be released.
- Required browser, accessibility, responsive and Limrun checks are complete.
- Independent code and security review findings are resolved or explicitly accepted.
- No unresolved critical/high severity issue remains.
- Local-first, Supabase opt-in/RLS and researcher-controlled review behavior are preserved.
- The release notes identify the exact commit and known limitations.

A successful Vercel build alone is not release approval.
