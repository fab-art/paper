from __future__ import annotations

import asyncio
import base64
import binascii
import hmac
import os
import re
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

import httpx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MAX_ROWS = 5000
MAX_LATEX_SECONDS = 45
MAX_COMPILE_FILES = 40
MAX_COMPILE_TEXT_BYTES = 3_000_000
MAX_COMPILE_ASSETS_BYTES = 3_000_000
SEARCH_CACHE_TTL_SECONDS = 600
_search_cache: dict[tuple[str, int, bool], tuple[float, dict[str, Any]]] = {}
_search_cache_lock = asyncio.Lock()

app = FastAPI(title="PaperOrchestra Studio Compute Engine", version="0.2.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def authenticate_engine(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method == "POST":
        expected = os.getenv("PAPERORCHESTRA_ENGINE_TOKEN", "")
        supplied = request.headers.get("authorization", "")
        if not expected:
            from starlette.responses import JSONResponse
            return JSONResponse({"detail": "Compute engine authentication is not configured."}, status_code=503)
        if not hmac.compare_digest(supplied, "Bearer " + expected):
            from starlette.responses import JSONResponse
            return JSONResponse({"detail": "Unauthorized compute request."}, status_code=401)

        endpoint = request.url.path.rsplit("/", 1)[-1]
        if endpoint in {"generate-plot", "compile-latex"}:
            forwarded = request.headers.get("x-forwarded-for", "")
            client_ip = forwarded.split(",", 1)[0].strip()
            if not client_ip and request.client:
                client_ip = request.client.host
            from backend.rate_limit import consume_rate_limit
            rate = consume_rate_limit(endpoint, client_ip or "unknown")
            if not rate["allowed"]:
                from starlette.responses import JSONResponse
                return JSONResponse(
                    {"detail": "Compute rate limit reached. Please wait before retrying."},
                    status_code=429,
                    headers={
                        "Retry-After": str(rate["retry_after"]),
                        "X-RateLimit-Limit": str(rate["limit"]),
                        "X-RateLimit-Remaining": "0",
                    },
                )
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(rate["limit"])
            response.headers["X-RateLimit-Remaining"] = str(rate["remaining"])
            return response
    return await call_next(request)


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
    files: dict[str, str] = Field(default_factory=dict)
    assets: dict[str, str] = Field(default_factory=dict)


@app.get("/api/health")
async def health():
    return {"ok": True, "latexmk": _which("latexmk") is not None, "engine": "python-tex"}


@app.post("/api/search-papers")
async def search_papers(request: SearchRequest):
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
    import time
    cache_key = (request.query.strip().casefold(), request.limit, bool(api_key))
    now = time.monotonic()
    async with _search_cache_lock:
        cached = _search_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]
        if cached:
            _search_cache.pop(cache_key, None)

    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "30")
                try:
                    retry_seconds = max(1, min(int(retry_after), 300))
                except ValueError:
                    retry_seconds = 30
                raise HTTPException(
                    status_code=429,
                    detail=f"Semantic Scholar is temporarily rate limiting searches. Please wait about {retry_seconds} seconds before trying again.",
                    headers={"Retry-After": str(retry_seconds)},
                )
            response.raise_for_status()
            payload = response.json()
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Semantic Scholar returned HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Semantic Scholar could not be reached. Please try again shortly.") from exc

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
    result = {"query": request.query, "papers": papers}
    async with _search_cache_lock:
        _search_cache[cache_key] = (time.monotonic() + SEARCH_CACHE_TTL_SECONDS, result)
        if len(_search_cache) > 500:
            current_time = time.monotonic()
            expired = [key for key, value in _search_cache.items() if value[0] <= current_time]
            for key in expired:
                _search_cache.pop(key, None)
            overflow = len(_search_cache) - 500
            if overflow > 0:
                oldest = sorted(_search_cache.items(), key=lambda item: item[1][0])[:overflow]
                for key, _ in oldest:
                    _search_cache.pop(key, None)
    return result


@app.post("/api/generate-plot")
async def generate_plot(request: PlotRequest):
    """Fixed-template chart rendering only; generated Python is never executed."""
    frame = pd.DataFrame(request.data)
    if request.x not in frame.columns or request.y not in frame.columns:
        raise HTTPException(status_code=400, detail=f"Columns not found. Available: {list(frame.columns)}")
    frame[request.y] = pd.to_numeric(frame[request.y], errors="coerce")
    frame = frame.dropna(subset=[request.x, request.y])
    if frame.empty:
        raise HTTPException(status_code=400, detail="No valid rows for the selected x/y columns.")

    fig, ax = plt.subplots(figsize=(8.5, 5.2), dpi=180)
    x_values, y_values = frame[request.x], frame[request.y]
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
        "mime_type": "image/png",
    }


def _safe_relative_path(name: str) -> Path:
    normalized = name.replace("\\", "/")
    candidate = PurePosixPath(normalized)
    if not normalized or candidate.is_absolute() or any(part in ("", ".", "..") for part in candidate.parts):
        raise HTTPException(status_code=400, detail=f"Unsafe compilation asset path: {name}")
    if re.match(r"^[A-Za-z]:", normalized):
        raise HTTPException(status_code=400, detail=f"Unsafe compilation asset path: {name}")
    return Path(*candidate.parts)


@app.post("/api/compile-latex")
async def compile_latex(request: CompileRequest):
    latexmk = _which("latexmk")
    if not latexmk:
        raise HTTPException(status_code=503, detail="latexmk was not found in the compute image.")
    if re.search(r"\\write18|--shell-escape|\\openout|\\read18", request.tex, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Shell/file I/O primitives are not accepted.")
    if re.search(r"\\(input|include)\s*\{(?:/|[A-Za-z]:|.*\.\.)", request.tex):
        raise HTTPException(status_code=400, detail="Absolute paths and parent-directory includes are not allowed.")
    if len(request.files) + len(request.assets) > MAX_COMPILE_FILES:
        raise HTTPException(status_code=413, detail="Too many template files or figure assets.")
    text_size = sum(len(value.encode("utf-8")) for value in request.files.values())
    if text_size > MAX_COMPILE_TEXT_BYTES:
        raise HTTPException(status_code=413, detail="Template files exceed the compilation size limit.")

    with tempfile.TemporaryDirectory(prefix="paperorchestra-") as tmp:
        work = Path(tmp)
        (work / "paper.tex").write_text(request.tex, encoding="utf-8")
        if request.bibtex.strip():
            (work / "references.bib").write_text(request.bibtex, encoding="utf-8")

        for name, content in request.files.items():
            relative = _safe_relative_path(name)
            target = work / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        asset_size = 0
        for name, encoded in request.assets.items():
            relative = _safe_relative_path(name)
            try:
                decoded = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise HTTPException(status_code=400, detail=f"Invalid base64 figure asset: {name}") from exc
            asset_size += len(decoded)
            if asset_size > MAX_COMPILE_ASSETS_BYTES:
                raise HTTPException(status_code=413, detail="Figure assets exceed the compilation size limit.")
            target = work / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(decoded)

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
