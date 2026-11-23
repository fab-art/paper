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

1. Import this repository into Vercel. Keep the project root at \`.\`, not \`frontend\`.
2. Use the committed \`vercel.json\` build settings.
3. Set Node.js to 22.x in Vercel Project Settings → General.
4. Add the environment variables in section C and deploy.

The WebLLM callback in \`frontend/src/lib/llm.ts\` is now explicitly typed. This fixes the reported TS7006 implicit-any error for parameter \`report\`.

## B. Railway compute deployment

1. Create a Railway project at https://railway.com.
2. Deploy from this GitHub repository.
3. Railway should detect the root Dockerfile. Keep service root directory as \`/\`.
4. Add Railway variables:
   - \`PAPERORCHESTRA_ENGINE_TOKEN\`: a long random secret (32+ random bytes).
   - \`CORS_ORIGINS\`: exact Vercel production origin, e.g. \`https://your-project.vercel.app\`.
5. Deploy. Health endpoint: \`https://YOUR-ENGINE.up.railway.app/api/health\`. Expected \`ok: true\` and \`latexmk: true\`.

The Docker image installs Python requirements and TeX Live, runs as a non-root user, disables TeX shell escape, and compiles in a temporary directory.

## C. Connect Vercel to Railway

Set these variables in Vercel → Project → Settings → Environment Variables:

- \`PAPERORCHESTRA_ENGINE_URL\` = Railway public URL (without trailing slash).
- \`PAPERORCHESTRA_ENGINE_TOKEN\` = the same secret configured in Railway.
- Optional \`SEMANTIC_SCHOLAR_API_KEY\` = Semantic Scholar API key.

Apply to Production and Preview as appropriate, then redeploy. The browser calls Vercel \`/api/engine/*\`; the Vercel proxy adds the secret token. The token is never sent to browser code.

## D. Test

- Open Railway \`/api/health\`.
- Open Vercel app, load WebLLM, run agents sequentially.
- Import a small CSV and run Plots; connected engine uses Matplotlib.
- Click Print / Save PDF; connected engine compiles the .tex with latexmk.
- If the engine is not configured, the UI retains its browser SVG/print preview fallback.

## Security and production limitations

- Never put the engine token in a \`VITE_*\` variable.
- Current LaTeX checks disable shell escape, reject several dangerous file primitives and paths, use a temporary working directory, and run the service as non-root. These are not a complete sandbox against malicious TeX. Before accepting arbitrary public user documents at scale, move compilation into one-shot isolated containers with strict CPU, memory, filesystem, network and wall-clock limits.
- The initial Railway service has no durable queue or account-level authorization. Protect it behind the Vercel proxy and keep the token secret.
- Generated claims, citations, plots and LaTeX require human review.

## Local development

\`\`\`bash
npm install
npm --prefix frontend install
npm --prefix frontend run dev
\`\`\`

For the backend install \`backend/requirements.txt\`, install TeX Live/MiKTeX with \`latexmk\`, set \`PAPERORCHESTRA_ENGINE_TOKEN\` and \`CORS_ORIGINS=http://localhost:5173\`, then run:

\`\`\`bash
uvicorn backend.main:app --reload --port 8000
\`\`\`

## Upstream source

The uploaded Google Research repository remains under \`upstream/paper-orchestra/\`. The Studio adapts the five-stage workflow to browser-local inference and bounded compute endpoints; it does not claim to directly execute the original Gemini-dependent Python classes.
