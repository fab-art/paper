from __future__ import annotations

import json
import os
import secrets
import threading
import time
import webbrowser
from pathlib import Path
from urllib.parse import urlparse

import uvicorn

from engine.main import APP_NAME, HOST, PORT, TOKEN, TOKEN_FILE, app

CONFIG_DIR = Path.home() / "PaperOrchestra"
CONFIG_FILE = CONFIG_DIR / "desktop-config.json"
DEFAULT_APP_URL = "https://YOUR-VERCEL-DOMAIN"


def valid_app_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def get_app_url() -> str:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    saved = {}
    if CONFIG_FILE.exists():
        try:
            saved = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            saved = {}
    url = os.getenv("PAPERORCHESTRA_APP_URL", saved.get("app_url", ""))
    if not valid_app_url(url):
        print("\nPaste your deployed PaperOrchestra Vercel URL (https://...):")
        url = input("> ").strip().rstrip("/")
        if not valid_app_url(url):
            raise SystemExit("A valid HTTPS Vercel URL is required.")
        CONFIG_FILE.write_text(json.dumps({"app_url": url}, indent=2), encoding="utf-8")
    return url


def start_engine() -> None:
    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning", access_log=False)
    server = uvicorn.Server(config)
    server.run()


def main() -> None:
    app_url = get_app_url()
    thread = threading.Thread(target=start_engine, daemon=True, name="PaperOrchestraLocalEngine")
    thread.start()
    for _ in range(40):
        try:
            import urllib.request
            with urllib.request.urlopen(f"http://{HOST}:{PORT}/api/health", timeout=1) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(0.25)
    else:
        raise SystemExit("Local FastAPI engine did not start. Check whether port 8765 is already in use.")

    print("\n" + "=" * 68)
    print("PaperOrchestra Desktop Companion is ready.")
    print(f"App: {app_url}")
    print(f"Local engine: http://{HOST}:{PORT}")
    print(f"Pairing token: {TOKEN}")
    print(f"Token file: {TOKEN_FILE}")
    print("\nIn the PWA, open Python Console → Local Engine Settings and paste")
    print("the pairing token. Keep it private. Close this window to stop the engine.")
    print("=" * 68)

    try:
        import webview
        webview.create_window(APP_NAME, app_url, width=1480, height=940, min_size=(1050, 700))
        webview.start()
    except Exception as exc:
        print(f"Desktop webview could not start: {exc}")
        print("Opening the PWA in your default browser instead.")
        webbrowser.open(app_url)
        input("Press Enter to stop the local engine...")
    finally:
        print("PaperOrchestra Local Engine stopped.")


if __name__ == "__main__":
    main()
