# PaperOrchestra Studio — Vercel First Release

A local-first academic writing PWA inspired by Google Research's PaperOrchestra. This first deployable release combines browser-local WebLLM inference, IndexedDB project storage, sequential research-writing stages, Semantic Scholar discovery through a Vercel serverless function, dataset plotting, and exportable LaTeX/BibTeX project files.

## What runs where

| Capability | Runtime | Deployment behavior |
|---|---|---|
| React PWA / IDE | Vercel static hosting | Hosted at your Vercel URL |
| Local language model | User's browser via WebGPU + WebLLM worker | Model weights download to the browser on first use; inference stays on-device |
| Projects and drafts | IndexedDB in the browser | Local to each browser/device; not synced to a server |
| Literature discovery | Vercel Function → Semantic Scholar | API key stays server-side if configured |
| Plot generation | Browser-side SVG renderer | No Python runtime required |
| Manuscript PDF | Browser print dialog | Print-ready HTML preview; choose “Save as PDF” |
| Native LaTeX compilation | Not included in Vercel release | Use a local TeX installation for true TeX compilation |

## Deploy to Vercel

1. Extract this ZIP and push the **contents of this project folder** to a new GitHub repository.
2. In Vercel, choose **Add New → Project**, import that GitHub repository.
3. Vercel should detect the `vercel.json` configuration. Confirm:
   - Build command: `npm --prefix frontend run build`
   - Output directory: `frontend/dist`
   - Install command: `npm --prefix frontend install`
4. Deploy. The serverless paper-search function is in `/api/search-papers.ts`.
5. Optional: in Vercel → Project → Settings → Environment Variables, add `SEMANTIC_SCHOLAR_API_KEY`. Redeploy after adding it. Search also works without a key subject to Semantic Scholar's public rate limits.

Do not set the Vercel project root to `frontend`; keep the repository root as the project root so Vercel can discover `/api/search-papers.ts`.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm --prefix frontend install
npm --prefix frontend run dev
```

The Vite dev server starts the UI. For the Semantic Scholar endpoint in local development, run the included FastAPI bridge (optional) or use Vercel CLI (`npx vercel dev`) from the project root. The Vite app's `/api` calls are intended for the Vercel function in deployment.

Build check:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## First use

1. Open the deployed app in a recent Chrome or Edge browser on a WebGPU-capable computer.
2. Create a project and enter your research idea, study context, methods, and available results in **Research notes**.
3. Upload a CSV/JSON experiment dataset if you want figures.
4. Load the local model. The default is Qwen2.5 3B quantized; first load requires a large download and internet access.
5. Choose Generic Article, CVPR 2025, or ICLR 2025 from the template selector. The CVPR/ICLR template files are bundled with the app and included in project ZIP exports.
6. Run the agents in order: Outline → Literature → Plots → Writing → Refine. Each stage is a separate inference call; do not run parallel projects on low-memory hardware.
7. Review and edit generated output. Verify every citation, data point, method, and claim.
8. Use **Print / Save PDF** for a browser-rendered reading copy, and **Export ZIP** to download `.tex`, `.bib`, notes, data, project JSON, and figures.

## Browser and hardware guidance

- WebLLM requires WebGPU. Use current Chrome/Edge and a current graphics driver.
- Start with Qwen2.5-3B Q4 and the 8K context option. The 12K option may fail on integrated graphics.
- WebGPU memory is shared with the browser and operating system. The UI's memory figure is an estimate, not a hardware measurement.
- If WebGPU is unavailable, configure a local OpenAI-compatible endpoint such as Ollama in Settings. The endpoint must permit browser CORS requests and be reachable from the browser device.
- Browser storage can be cleared by the browser or user. Export backups regularly. Projects are not cloud-synced.

## Relationship to the uploaded Google Research repository

The uploaded upstream repository is preserved under `upstream/paper-orchestra/`, including its agents, prompt modules, templates, utilities, README, and Apache 2.0 license. The Studio interface is a browser-native compatibility implementation of the five major workflow stages, not a direct execution of the original Python classes.

The original Python agents call Gemini/OpenAI SDKs directly in multiple places. The literature and plotting agents also create internal thread pools, and the original refinement workflow uses PDF screenshots/vision review. Those assumptions do not map directly to browser WebLLM or Vercel's serverless runtime. This first release therefore:
- keeps the five-stage responsibilities and retains the original source for traceability;
- executes model requests sequentially in one WebLLM worker;
- uses Semantic Scholar metadata search through a server-side proxy;
- creates safe, fixed-template SVG figures in the browser rather than executing generated Python;
- performs a text/LaTeX-oriented refinement pass rather than claiming parity with the upstream vision-based reviewer.

## Limitations of this first release

- No multi-device cloud sync, accounts, collaboration, or remote database.
- No server-side persistent Python process on Vercel.
- No arbitrary Python execution or generated-code sandbox.
- The browser print preview is a convenient reading/export path, **not a replacement for compiling the source with LaTeX**. For camera-ready output, compile the exported `.tex` using TeX Live/MiKTeX and the relevant official conference template.
- Semantic Scholar results are candidates, not proof of relevance or correctness. Confirm paper metadata and read the source before citing it.
- Local models can produce unsupported statements or malformed LaTeX. Human review remains essential.

## Project layout

```text
paperorchestra-studio/
├── api/search-papers.ts       # Vercel serverless Semantic Scholar proxy
├── frontend/                  # Vite + React PWA
│   └── src/
│       ├── agents/prompts.ts
│       ├── components/Studio.tsx
│       ├── lib/                # WebLLM, IndexedDB, API, export, types
│       └── workers/            # WebLLM dedicated worker
├── upstream/paper-orchestra/  # Uploaded Google Research source + templates
├── backend/                   # Optional local FastAPI bridge
├── package.json
└── vercel.json
```
