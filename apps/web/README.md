# PaperOrchestra Research Factory — New Frontend

This is the independent replacement frontend. It is intentionally separate from the production app in `frontend/`.

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

Browser tests use Playwright + axe to verify the local IndexedDB read path, navigation, responsive widths, browser errors and WCAG 2.2 A/AA rules.

The app uses the existing IndexedDB database `paperorchestra-studio` in read-only mode for its first milestone. It does not create a parallel database or mutate legacy project records.

## Lumen

The app pins `@santi020k/lumen-react@4.3.0`, the published adapter version verified for this repository. Do not copy contracts from the connected 5.3.0 catalog into this app until that package version is actually published and compatibility-checked.

## Deployment

This app is not the production deployment target yet. The repository-root `vercel.json` remains unchanged. Use an isolated Vercel project/preview with the project root set to `apps/web` only after the app CI is green.
