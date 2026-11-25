# PaperOrchestra Studio — Hybrid Vercel + Railway

PaperOrchestra Studio is a local-first academic writing PWA inspired by Google Research's PaperOrchestra. Vercel hosts the application, WebLLM runs in the user's browser, and Railway hosts a protected Python + TeX compute service.

## Runtime architecture

| Component | Runs on | Responsibility |
|---|---|---|
| React PWA | Vercel | IDE and static assets |
| Five AI stages | Browser WebGPU/WebLLM | Sequential outline, literature planning, plot instructions, writing, refinement |
| Literature search | Vercel Function | Semantic Scholar proxy |
| Compute engine | Railway Docker service | Python, Pandas, Matplotlib, TeX Live and latexmk |
| Projects | Browser IndexedDB | Local-first drafts and project data |

The compute engine does not host or invoke an LLM. Model inference stays in the browser. Python handles chart rendering and TeX compilation.

## A. Vercel deployment

1. Import this repository into Vercel. Keep the project root at the repository root, not frontend.
2. Use the committed vercel.json build settings.
3. Set Node.js to 22.x in Vercel Project Settings → General.
4. Deploy.

The WebLLM initialization callback is explicitly typed, fixing the reported TS7006 implicit-any error for parameter report. The PWA cache limit is raised to 12 MiB because the WebLLM assets exceed Workbox's 2 MiB default. The WebLLM runtime is lazy-loaded to reduce the initial application bundle.

## B. Railway compute deployment

1. Create a Railway project at https://railway.com.
2. Deploy from this GitHub repository.
3. Railway should detect the root Dockerfile. Keep service root directory as /.
4. Add Railway variables:
   - PAPERORCHESTRA_ENGINE_TOKEN: a long random secret (32+ random bytes).
   - CORS_ORIGINS: exact Vercel production origin, e.g. https://your-project.vercel.app.
5. Deploy. Health endpoint: https://YOUR-ENGINE.up.railway.app/api/health. Expected ok: true and latexmk: true.

The Docker image installs Python requirements and TeX Live, runs as a non-root user, disables TeX shell escape, and compiles in a temporary directory. Template style files and figure assets are included in compilation requests with path and size checks.

## C. Connect Vercel to Railway

Set these variables in Vercel → Project → Settings → Environment Variables:

- PAPERORCHESTRA_ENGINE_URL = Railway public URL (without trailing slash).
- PAPERORCHESTRA_ENGINE_TOKEN = the same secret configured in Railway.
- UPSTASH_REDIS_REST_URL = Upstash Redis REST endpoint used for compute abuse protection.
- UPSTASH_REDIS_REST_TOKEN = Upstash Redis REST token. Compute proxy requests fail closed until both rate-limit variables are configured.
- Optional SEMANTIC_SCHOLAR_API_KEY = Semantic Scholar API key.

Apply to Production and Preview as appropriate, then redeploy. The browser calls Vercel /api/engine/*; the Vercel proxy adds the secret token. The token is never sent to browser code. The proxy applies per-IP limits of 4 LaTeX compilations and 20 plot requests per minute using Upstash Redis; configure both Upstash variables in Vercel Preview and Production.

## D. Test

- Open Railway /api/health.
- Open Vercel app, load WebLLM, run agents sequentially.
- Import a small CSV and run Plots; connected engine uses Matplotlib.
- Click Print / Save PDF; connected engine compiles the .tex with latexmk and returns a PDF for the preview pane.
- If the engine is not configured, the app retains its browser SVG/print preview fallback.

## Security and production limitations

- Never put the engine token in a VITE_ variable.
- Current LaTeX checks disable shell escape, reject several dangerous file primitives and paths, use a temporary working directory, and run the service as non-root. These are not a complete sandbox against malicious TeX. Before accepting arbitrary public user documents at scale, move compilation into one-shot isolated containers with strict CPU, memory, filesystem, network and wall-clock limits.
- The initial Railway service has no durable queue or account-level authorization. Protect it behind the Vercel proxy and keep the token secret.
- Generated claims, citations, plots and LaTeX require human review.

## Local development

Install dependencies:

    npm install
    npm --prefix frontend install
    npm --prefix frontend run dev

For the backend install backend/requirements.txt and install TeX Live/MiKTeX with latexmk. Set the same local secret in both PowerShell terminals; it must match the token expected by FastAPI and is read only by the Vite development server and backend, never by browser code.

Terminal 1 — start FastAPI:

    $env:PAPERORCHESTRA_ENGINE_TOKEN="your-long-local-secret"
    $env:CORS_ORIGINS="http://localhost:5173"
    uvicorn backend.main:app --reload --port 8000

Terminal 2 — start Vite with the proxy secret:

    $env:PAPERORCHESTRA_ENGINE_TOKEN="your-long-local-secret"
    npm --prefix frontend run dev

## Upstream source

The uploaded Google Research repository remains under upstream/paper-orchestra/. The Studio adapts the five-stage workflow to browser-local inference and bounded compute endpoints; it does not claim to directly execute the original Gemini-dependent Python agent classes.


## E. Windows desktop companion (local Python execution)

The optional Windows companion adds a desktop window for the Vercel PWA and runs a local FastAPI engine on the user's computer. Python execution stays on the Windows machine; it does not use Railway.

1. Install 64-bit Python 3.11 or 3.12.
2. Open the repository folder and double-click `desktop/start_windows.bat`.
3. On first launch, paste the deployed Vercel HTTPS URL when prompted. The launcher creates a Python virtual environment and installs the local scientific stack.
4. Copy the pairing token printed in the companion console.
5. In PaperOrchestra, open the **Python console** tab, expand **Local Engine Settings**, paste the token and select **Save & connect**.

The local engine binds only to `127.0.0.1:8765`. It creates `%USERPROFILE%\\PaperOrchestra\\workspace` as the default working directory. The pairing token is stored under `%USERPROFILE%\\PaperOrchestra\\local-engine-token`.

See [desktop/README.md](desktop/README.md) for setup and troubleshooting. Python scripts run with the permissions of the signed-in Windows account; the workspace is not a security sandbox. Only execute code you trust. Never forward port 8765 to the internet.


## Phase 7 — Optional cloud collaboration

PaperOrchestra remains local-first. Existing research projects are stored in the browser's IndexedDB and are not uploaded when a user signs in. Cloud collaboration is enabled only after the owner explicitly shares a project.

To enable the optional account UI during local development, copy `frontend/.env.example` to `frontend/.env.local` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred; the legacy `VITE_SUPABASE_ANON_KEY` is also accepted)

Use only the Supabase publishable key in browser configuration. Never place a Supabase service-role or secret key in a `VITE_*` variable, frontend source, or Vercel client environment. Configure the exact production and preview callback URLs in Supabase Auth before testing email links.

The collaboration migrations in `supabase/migrations/` have been applied to the dedicated PaperOrchestra Supabase project. The Health Advisor reports no findings. The Security Advisor currently reports one warning: leaked-password protection is disabled and must be enabled in Supabase Auth before production use. Performance Advisor reports unused indexes because the collaboration tables are still empty. The sign-in UI is enabled on the Phase 7 Vercel preview only; project sharing, invitations, sync, comments UI and version restore are subsequent delivery slices. Existing local projects remain local until an explicit Share action is implemented.


## Phase 8 — Systematic Review & Evidence Synthesis

The project workspace now includes a local-first systematic review area for protocol details, DOI/title deduplication, title/abstract and full-text screening, PRISMA-style working counts, structured study extraction, domain-level risk-of-bias notes and evidence-matrix CSV export. Decisions remain researcher-led and are stored in the local IndexedDB project. See [Phase 8 architecture and counting rules](docs/phase8-systematic-review.md). The displayed flow is a working count summary, not a certified PRISMA 2020 diagram. Cloud sync, automated screening and automated extraction are not included in this phase.


## Phase 9 — Lumen UI System-Wide Redesign

Phase 9 establishes the cross-phase redesign specification for the React PWA using the Lumen UI React design system. It covers the application shell and every Phase 1–8 surface while preserving local-first IndexedDB, optional Supabase/RLS, browser WebLLM, bounded local data processing, export safeguards and researcher-led review decisions. See [Phase 9 redesign architecture and acceptance criteria](docs/phase9-lumen-redesign.md). The implementation must pin the Lumen adapter and lockfile together, then pass regression, accessibility, responsive, production-build and exact-commit Vercel Preview checks before release.
