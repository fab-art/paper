# PaperOrchestra Research Factory

This is the active Research Factory application and the intended production frontend. It lives in `apps/web/` and uses the existing `frontend/` data/domain modules through a compatibility adapter while preserving the established local project database.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

Browser tests use Playwright + axe to verify local project creation and persistence, workspace navigation, search, literature saving, evidence extraction/appraisal, manuscript editing, responsive widths, browser errors and WCAG 2.2 A/AA rules.

The app reads and writes the existing IndexedDB database `paperorchestra-studio` through the legacy-project adapter and its revision/tombstone guards. Project records, notes, attachments, literature, review decisions and manuscripts remain in the existing local store. No parallel database or destructive migration is introduced. Supabase sharing remains opt-in.

## Lumen

The app pins `@santi020k/lumen-react@4.3.0` and matching runtime dependencies. The connected 5.3.0 catalog is a different contract; use the published 4.3.0 package types and source for implementation.

## Deployment

Use the existing Vercel project `paper` with the project root directory set to `apps/web` and Node.js `22.x`. Vercel will then load this directory's `vercel.json`, discover the app's `api/` functions, build with `npm run build`, serve `dist`, and apply the SPA rewrites. The repository-root `vercel.json` remains for the legacy app and must not be used for the Research Factory production build. Stage a preview from the exact release commit before promoting the production domain.
