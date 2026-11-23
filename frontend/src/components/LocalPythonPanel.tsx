import { useEffect, useState } from "react";
import "./local-python.css";
import { Activity, CheckCircle2, CircleAlert, Play, Settings2, Terminal, Wifi, WifiOff } from "lucide-react";

const DEFAULT_URL = "http://127.0.0.1:8765";
const TOKEN_KEY = "paperorchestra.localEngineToken";
const URL_KEY = "paperorchestra.localEngineUrl";

type Health = { ok: boolean; python: string; workspace: string; capabilities: string[] };
type RunResult = { ok: boolean; return_code: number; stdout: string; stderr: string; workspace: string };

export default function LocalPythonPanel() {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(URL_KEY) || DEFAULT_URL);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [showSettings, setShowSettings] = useState(!localStorage.getItem(TOKEN_KEY));
  const [code, setCode] = useState('import sys\nimport numpy as np\nimport pandas as pd\n\nprint("Python:", sys.version)\nprint("NumPy:", np.__version__)\nprint("Pandas:", pd.__version__)');
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (token) void checkConnection(); }, []);

  const checkConnection = async () => {
    setConnected(false); setError("");
    const root = baseUrl.trim().replace(/\/$/, "");
    try {
      const response = await fetch(root + "/api/health", { method: "GET" });
      if (!response.ok) throw new Error("Local engine returned HTTP " + response.status);
      const info = await response.json() as Health;
      if (!info.ok) throw new Error("Local engine health check failed.");
      setHealth(info);
      if (token.trim()) {
        const auth = await fetch(root + "/api/workspace", { headers: { Authorization: "Bearer " + token.trim() } });
        if (!auth.ok) throw new Error(auth.status === 401 ? "Pairing token is incorrect." : "Authentication check failed.");
        setConnected(true);
      } else {
        setError("Engine is running. Add the pairing token printed in the companion window.");
      }
    } catch (e) {
      setHealth(null); setConnected(false);
      setError((e as Error).message.includes("Failed to fetch")
        ? "Cannot reach the local engine. Start PaperOrchestra Desktop Companion and allow local network access in your browser."
        : (e as Error).message);
    }
  };

  const saveSettings = async () => {
    localStorage.setItem(URL_KEY, baseUrl.trim().replace(/\/$/, ""));
    localStorage.setItem(TOKEN_KEY, token.trim());
    await checkConnection();
    setShowSettings(false);
  };

  const runCode = async () => {
    if (!connected || busy) return;
    if (!window.confirm("Run this Python code on your Windows computer? Review the code first. It runs with your Windows account permissions and is not sandboxed.")) return;
    setBusy(true); setOutput(""); setError("");
    try {
      const response = await fetch(baseUrl.trim().replace(/\/$/, "") + "/api/python/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token.trim() },
        body: JSON.stringify({ code, timeout_seconds: 60 })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : payload.detail?.message || "Python execution failed.");
      const result = payload as RunResult;
      setOutput([result.stdout, result.stderr ? "\n--- STDERR ---\n" + result.stderr : "", "\n[exit code: " + result.return_code + "]"].join(""));
      if (!result.ok) setError("The Python process returned a non-zero exit code.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return <div className="python-console">
    <div className="python-console-head">
      <div><div className="eyebrow">LOCAL COMPUTE / WINDOWS COMPANION</div><h2>Python <span>Console</span></h2><p>Execute research code using the Python environment installed on your Windows computer.</p></div>
      <div className={connected ? "engine-status connected" : "engine-status"}>{connected ? <CheckCircle2 size={14}/> : <WifiOff size={14}/>} {connected ? "ENGINE CONNECTED" : "ENGINE OFFLINE"}</div>
    </div>
    <div className="python-toolbar">
      <span><Terminal size={14}/> Python 3 · local subprocess</span>
      <button className="secondary-button" onClick={() => setShowSettings(v => !v)}><Settings2 size={13}/> Local Engine Settings</button>
      <button className="secondary-button" onClick={() => void checkConnection()}><Activity size={13}/> Check connection</button>
    </div>
    {showSettings && <div className="python-settings">
      <label>Local engine URL<input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8765"/></label>
      <label>Pairing token<input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste token printed by the Windows companion"/></label>
      <div className="python-settings-actions"><span>Token is stored in this browser's local storage.</span><button className="primary-button" onClick={() => void saveSettings()}><Wifi size={13}/> Save & connect</button></div>
    </div>}
    {health && <div className="engine-details"><span>Python {health.python}</span><span>Workspace: {health.workspace}</span><span>{health.capabilities.join(" · ")}</span></div>}
    {error && <div className="python-alert"><CircleAlert size={14}/>{error}</div>}
    <div className="python-editor-label">SCRIPT.PY <span>Review before running · 60 second timeout</span></div>
    <textarea className="python-code" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} aria-label="Python code"/>
    <div className="python-run-row"><span>Runs in %USERPROFILE%\\PaperOrchestra\\workspace</span><button className="primary-button" disabled={!connected || busy || !code.trim()} onClick={() => void runCode()}>{busy ? "Running…" : <><Play size={13}/> Run Python</>}</button></div>
    <div className="python-output"><div className="python-output-head"><Terminal size={13}/> OUTPUT</div><pre>{output || "Execution output will appear here."}</pre></div>
    <p className="python-warning">Security: scripts run as your Windows user and can access files and network resources available to that account. This is not an OS sandbox. Run only code you trust.</p>
  </div>;
}
