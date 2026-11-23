from __future__ import annotations

import hmac
import os
import secrets
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_NAME = "PaperOrchestra Local Engine"
VERSION = "0.1.0"
HOST = "127.0.0.1"
PORT = 8765
MAX_CODE_CHARS = 30_000
MAX_RUNTIME_SECONDS = 120
MAX_OUTPUT_CHARS = 60_000
HOME = Path.home()
DATA_DIR = HOME / "PaperOrchestra"
WORKSPACE = DATA_DIR / "workspace"
TOKEN_FILE = DATA_DIR / "local-engine-token"

DATA_DIR.mkdir(parents=True, exist_ok=True)
WORKSPACE.mkdir(parents=True, exist_ok=True)


def get_token() -> str:
    configured = os.getenv("PAPERORCHESTRA_LOCAL_TOKEN", "").strip()
    if configured:
        return configured
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            return token
    token = secrets.token_urlsafe(36)
    TOKEN_FILE.write_text(token, encoding="utf-8")
    try:
        TOKEN_FILE.chmod(0o600)
    except OSError:
        pass
    return token


TOKEN = get_token()
app = FastAPI(title=APP_NAME, version=VERSION)
allowed_origins = [
    item.strip() for item in os.getenv(
        "PAPERORCHESTRA_ALLOWED_ORIGINS",
        "https://paper.vercel.app,https://paper-orchestra.vercel.app,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if item.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class ExecuteRequest(BaseModel):
    code: str = Field(min_length=1, max_length=MAX_CODE_CHARS)
    timeout_seconds: int = Field(default=30, ge=1, le=MAX_RUNTIME_SECONDS)


def authorize(authorization: str | None) -> None:
    if not authorization or not hmac.compare_digest(authorization, "Bearer " + TOKEN):
        raise HTTPException(status_code=401, detail="Local engine pairing token is missing or invalid.")


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "name": APP_NAME,
        "version": VERSION,
        "python": sys.version.split()[0],
        "workspace": str(WORKSPACE),
        "capabilities": ["python", "pandas", "numpy", "matplotlib", "scipy", "scikit-learn", "statsmodels"],
    }


@app.post("/api/python/execute")
async def execute_python(
    payload: ExecuteRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    authorize(authorization)
    # This is an explicit user-triggered local code runner, not an OS sandbox.
    # The code runs with the permissions of the Windows account that launched the companion.
    try:
        result = subprocess.run(
            [sys.executable, "-I", "-c", payload.code],
            cwd=WORKSPACE,
            capture_output=True,
            text=True,
            timeout=payload.timeout_seconds,
            check=False,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        stderr = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        raise HTTPException(
            status_code=408,
            detail={"message": f"Python execution exceeded {payload.timeout_seconds} seconds.", "stdout": stdout[-MAX_OUTPUT_CHARS:]},
        ) from exc
    return {
        "ok": result.returncode == 0,
        "return_code": result.returncode,
        "stdout": result.stdout[-MAX_OUTPUT_CHARS:],
        "stderr": result.stderr[-MAX_OUTPUT_CHARS:],
        "workspace": str(WORKSPACE),
    }


@app.get("/api/workspace")
async def workspace(authorization: str | None = Header(default=None)) -> dict[str, str]:
    authorize(authorization)
    return {"path": str(WORKSPACE), "note": "Python starts in this directory. Scripts can still access files permitted to your Windows account."}


if __name__ == "__main__":
    import uvicorn
    print(f"{APP_NAME} listening on http://{HOST}:{PORT}")
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
