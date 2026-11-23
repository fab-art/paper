@echo off
setlocal
cd /d "%~dp0"
echo.
echo  PaperOrchestra Desktop Companion - first-time setup
echo  This installs the local Python engine and research packages.
echo.
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3.11 or 3.12 from python.org
    echo Make sure "Add Python to PATH" is selected.
    pause
    exit /b 1
  )
)
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency installation failed. Check your internet connection and Python version.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" launcher.py
if errorlevel 1 pause
endlocal
