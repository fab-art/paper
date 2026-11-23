from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
import textwrap
from pathlib import Path
from typing import Any

import httpx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).resolve().parent
MAX_ROWS = 5000
MAX_SCRIPT_SECONDS = 12
MAX_LATEX_SECONDS = 45

app = FastAPI(title="PaperOrchestra Studio API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    limit: int = Field(default=6, ge=1, le=20)


class PlotRequest(BaseModel):
    data: list[dict[str, Any]] = Field(min_length=1, max_length=MAX_ROWS)
    x: str = Field(min_length=1, max_length=100)
    y: str = Field(min_length=1, max_length=100)
    title: str = Field(default="Research figure", max_length=180)


class CompileRequest(BaseModel):
    tex: str = Field(min_length=1, max_length=500_000)
    bibtex: str = Field(default="", max_length=300_000)


@app.get("/api/health")
async def health():
    return {"ok": True, "latexmk": _which("latexmk") is not None}


@app.post("/api/search-papers")
async def search_papers(request: SearchRequest):
    """Proxy Semantic Scholar paper search to avoid browser CORS and keep API key server-side."""
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": request.query,
        "limit": request.limit,
        "fields": "title,authors,year,abstract,url,externalIds,openAccessPdf",
    }
    headers = {}
    api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key
    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Semantic Scholar returned HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Semantic Scholar request failed: {exc}") from exc

    papers = []
    for item in payload.get("data", []):
        authors = [a.get("name", "") for a in item.get("authors", []) if a.get("name")]
        external = item.get("externalIds") or {}
        papers.append({
            "title": item.get("title") or "Untitled paper",
            "authors": authors,
            "year": item.get("year"),
            "abstract": item.get("abstract"),
            "url": item.get("url"),
            "doi": external.get("DOI"),
        })
    return {"query": request.query, "papers": papers}


@app.post("/api/generate-plot")
async def generate_plot(request: PlotRequest):
    """Generate a figure from tabular data using a fixed plotting template (no arbitrary code execution)."""
    frame = pd.DataFrame(request.data)
    if request.x not in frame.columns or request.y not in frame.columns:
        raise HTTPException(status_code=400, detail=f"Columns not found. Available: {list(frame.columns)}")
    if not pd.api.types.is_numeric_dtype(frame[request.y]):
        frame[request.y] = pd.to_numeric(frame[request.y], errors="coerce")
    frame = frame.dropna(subset=[request.x, request.y])
    if frame.empty:
        raise HTTPException(status_code=400, detail="No valid rows for the selected x/y columns.")

    fig, ax = plt.subplots(figsize=(8.5, 5.2), dpi=180)
    x_values = frame[request.x]
    y_values = frame[request.y]
    if pd.api.types.is_numeric_dtype(x_values):
        ax.plot(x_values, y_values, marker="o", linewidth=1.8)
    else:
        ax.bar(x_values.astype(str), y_values)
        ax.tick_params(axis="x", labelrotation=30)
    ax.set_title(request.title)
    ax.set_xlabel(request.x)
    ax.set_ylabel(request.y)
    ax.grid(True, alpha=0.22)
    fig.tight_layout()

    from io import BytesIO
    png, pdf = BytesIO(), BytesIO()
    fig.savefig(png, format="png", dpi=220, bbox_inches="tight")
    fig.savefig(pdf, format="pdf", bbox_inches="tight")
    plt.close(fig)
    return {
        "filename": "figure.png",
        "png_base64": base64.b64encode(png.getvalue()).decode("ascii"),
        "pdf_base64": base64.b64encode(pdf.getvalue()).decode("ascii"),
    }


@app.post("/api/compile-latex")
async def compile_latex(request: CompileRequest):
    latexmk = _which("latexmk")
    if not latexmk:
        raise HTTPException(status_code=503, detail="latexmk was not found on PATH. Install TeX Live or MiKTeX and latexmk.")
    # Reject obvious path escapes and shell escape. Compilation remains for trusted local documents only.
    if re.search(r"\\write18|--shell-escape|\\openout|\\read18", request.tex, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Shell/file I/O primitives are not accepted by this local compile endpoint.")
    if re.search(r"\\(input|include)\s*\{(?:/|[A-Za-z]:|.*\.\.)", request.tex):
        raise HTTPException(status_code=400, detail="Absolute paths and parent-directory includes are not allowed.")

    with tempfile.TemporaryDirectory(prefix="paperorchestra-") as tmp:
        work = Path(tmp)
        (work / "paper.tex").write_text(request.tex, encoding="utf-8")
        if request.bibtex.strip():
            (work / "references.bib").write_text(request.bibtex, encoding="utf-8")
        try:
            result = subprocess.run(
                [latexmk, "-pdf", "-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", "paper.tex"],
                cwd=work, capture_output=True, text=True, timeout=MAX_LATEX_SECONDS, check=False,
                env={**os.environ, "openout_any": "p", "openin_any": "p"},
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=504, detail="LaTeX compilation timed out after 45 seconds.") from exc
        pdf_path = work / "paper.pdf"
        if result.returncode != 0 or not pdf_path.exists():
            log = (result.stdout + "\n" + result.stderr)[-5000:]
            raise HTTPException(status_code=422, detail=f"LaTeX compilation failed:\n{log}")
        return {
            "filename": "paper.pdf",
            "pdf_base64": base64.b64encode(pdf_path.read_bytes()).decode("ascii"),
        }


def _which(command: str) -> str | None:
    from shutil import which
    return which(command)
