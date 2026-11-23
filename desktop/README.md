# PaperOrchestra Windows Desktop Companion

The companion opens the deployed PaperOrchestra PWA in a Windows desktop window and starts a FastAPI engine bound to **127.0.0.1 only**. Python runs on the Windows computer, not on Vercel or Railway.

## Requirements

- Windows 10/11
- Python 3.11 or 3.12 (64-bit), installed from python.org with the PATH option enabled
- Internet access for the first package installation and for loading the hosted PWA
- Microsoft Edge WebView2 Runtime (normally present on current Windows 11 systems)

## Start

Double-click `start_windows.bat`. On first run it creates a virtual environment and installs FastAPI, NumPy, Pandas, Matplotlib, SciPy, scikit-learn, statsmodels and pywebview. The launcher asks for your deployed Vercel URL once, then saves it in `%USERPROFILE%\PaperOrchestra\desktop-config.json`.

The console prints a local pairing token. In the PWA, open **Python Console**, expand **Local Engine Settings**, paste the token and connect. Keep the token private. It is stored in `%USERPROFILE%\PaperOrchestra\local-engine-token`.

## What it does

- Executes Python code submitted by the Python Console in a subprocess.
- Uses the companion's virtual environment, including the installed scientific Python packages.
- Starts each run in `%USERPROFILE%\PaperOrchestra\workspace`.
- Returns standard output, errors, exit code and timeout information.
- Keeps the service on loopback; it does not listen on your LAN or public internet.

## Important security boundary

The Python console is a local code execution feature. A Python script runs with the same Windows account permissions as the companion. The workspace is the default working directory, **not a security sandbox**: code can still read or modify other files accessible to your account, start processes, and use the network. Run only code you trust. The UI requires a deliberate Run click; review generated code before executing it. A stronger OS-level sandbox (Windows Sandbox/AppContainer or a dedicated restricted user) is a separate hardening step and is not claimed by this first version.

The token is a pairing gate, not a substitute for Windows account security. The service binds only to 127.0.0.1 and CORS is limited to the configured app origins. Set `PAPERORCHESTRA_ALLOWED_ORIGINS` before launch if your Vercel hostname differs from the defaults. Never expose port 8765 through router port forwarding.

## Troubleshooting

- If port 8765 is busy, close the other local engine process or change `PORT` in `desktop/engine/main.py` and the matching URL in `frontend/src/components/LocalPythonPanel.tsx`.
- If the desktop window fails, update/install Microsoft Edge WebView2 Runtime. The launcher falls back to opening the PWA in your default browser.
- If your Vercel URL is not accepted, it must begin with `https://`.
