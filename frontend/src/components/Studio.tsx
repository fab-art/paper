import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeft, BookOpen, BrainCircuit, Check, ChevronDown, CircleAlert, Download, FileText, FolderOpen, Gauge, Image, Loader2, Play, Plus, RefreshCw, Settings2, Sparkles, Trash2, Upload, Unplug, Zap } from "lucide-react";
import { AGENTS, type AgentId, type OutlineSection, type Paper, type Project } from "../lib/types";
import { listProjects, loadProject, saveProject } from "../lib/db";
import { loadLocalModel, unloadModel, complete, fallbackComplete, MODEL_OPTIONS } from "../lib/llm";
import { searchPapers, generatePlot, compileLatex } from "../lib/api";
import { exportProject } from "../lib/export";
import LocalPythonPanel from "./LocalPythonPanel";
import { outlinePrompt, literatureQueryPrompt, plotPrompt, writingPrompt, refinePrompt } from "../agents/prompts";

const uid = () => Math.random().toString(36).slice(2, 10);
const initialProject = (): Project => ({
  id: uid(), name: "Untitled research project", notes: "", latex: "\\documentclass{article}\n\\usepackage{graphicx}\n\\usepackage{natbib}\n\\title{Research Manuscript}\n\\begin{document}\n\\maketitle\n\\end{document}",
  bibtex: "", template: "Generic Article", outline: [], papers: [], figures: [], logs: "", templateFiles: {},
  agentRecords: AGENTS.map(a => ({ id: a.id, status: "idle", summary: "", updatedAt: Date.now() })), updatedAt: Date.now()
});
const templates = ["Generic Article", "CVPR 2025", "ICLR 2025"];
const latexEscape = (value: string) => value
  .replace(/\\/g, "\\textbackslash{}")
  .replace(/([{}#$%&_])/g, "\\$1");
function insertSection(latex: string, title: string, body: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp("\\\\section\\*?\\{" + escaped + "\\}", "i");
  const match = heading.exec(latex);
  if (match && match.index >= 0) {
    const afterHeading = match.index + match[0].length;
    const label = /^\s*\\label\{[^}]+\}\s*/.exec(latex.slice(afterHeading));
    const contentStart = afterHeading + (label?.[0].length || 0);
    const tail = latex.slice(contentStart);
    const boundary = /\\section\*?\{|\\bibliography\{|\\begin\{thebibliography\}|\\end\{document\}/.exec(tail);
    const contentEnd = boundary ? contentStart + boundary.index : latex.length;
    return latex.slice(0, contentStart) + "\n" + body.trim() + "\n\n" + latex.slice(contentEnd);
  }
  const boundary = /\\bibliography\{|\\begin\{thebibliography\}|\\end\{document\}/.exec(latex);
  const index = boundary ? boundary.index : latex.length;
  const block = `\n\\section{${latexEscape(title)}}\n${body.trim()}\n`;
  return latex.slice(0, index) + block + latex.slice(index);
}

const parseJson = <T,>(text: string): T => {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(clean);
};
const bibtexEscape = (value: string) => value.replace(/[{}]/g, "").replace(/&/g, "\\&");
function papersToBibtex(papers: Paper[]) {
  return papers.map((paper, index) => {
    const firstAuthor = paper.authors?.[0]?.split(/\s+/).pop() || "Unknown";
    const year = paper.year || "nd";
    const stem = paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || `paper${index + 1}`;
    const key = `${firstAuthor.replace(/[^a-z0-9]/gi, "")}${year}${stem}`.toLowerCase();
    const fields = [
      `  title = {${bibtexEscape(paper.title)}}`,
      paper.authors?.length ? `  author = {${bibtexEscape(paper.authors.join(" and "))}}` : "",
      paper.year ? `  year = {${paper.year}}` : "",
      paper.venue ? `  journal = {${bibtexEscape(paper.venue)}}` : "",
      paper.doi ? `  doi = {${bibtexEscape(paper.doi)}}` : "",
      paper.url ? `  url = {${bibtexEscape(paper.url)}}` : ""
    ].filter(Boolean);
    return `@misc{${key},\n${fields.join(",\n")}\n}`;
  }).join("\n\n");
}

export default function Studio({ onBack }: { onBack?: () => void }) {
  const [project, setProject] = useState<Project>(initialProject);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentId>("outline");
  const [tab, setTab] = useState<"workspace" | "latex" | "literature" | "plots" | "python">("workspace");
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Model not loaded");
  const [tokensPerSec, setTokensPerSec] = useState(0);
  const [gpu, setGpu] = useState("Checking WebGPU…");
  const [context, setContext] = useState("8192");
  const [endpoint, setEndpoint] = useState("");
  const [fallbackModel, setFallbackModel] = useState("qwen2.5:3b");
  const [useFallback, setUseFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState("");
  const [pdf, setPdf] = useState<string>();
  const [feedback, setFeedback] = useState("");
  const [plotData, setPlotData] = useState("");
  const [notice, setNotice] = useState("Ready for a new research project.");
  const [showSettings, setShowSettings] = useState(false);
  const notesRef = useRef<HTMLInputElement>(null);
  const logsRef = useRef<HTMLInputElement>(null);
  const records = useMemo(() => Object.fromEntries(project.agentRecords.map(r => [r.id, r])), [project.agentRecords]);

  useEffect(() => {
    setGpu("gpu" in navigator ? "WebGPU available" : "WebGPU unavailable");
    listProjects().then(setProjects).catch(() => {});
    const requestedProjectId = localStorage.getItem("paperorchestra:open-project");
    if (requestedProjectId) {
      loadProject(requestedProjectId).then(saved => {
        if (saved) setProject(saved);
        localStorage.removeItem("paperorchestra:open-project");
      }).catch(() => {});
    }
    const listener = (e: Event) => setTokensPerSec(Math.max(0, Math.round((e as CustomEvent<number>).detail)));
    window.addEventListener("studio:tokens", listener);
    return () => window.removeEventListener("studio:tokens", listener);
  }, []);
  useEffect(() => {
    // When launched from the dashboard, wait for the selected IndexedDB project to hydrate.
    if (localStorage.getItem("paperorchestra:open-project")) return;
    saveProject(project).catch(() => {});
  }, [project]);

  const patch = (changes: Partial<Project>) => setProject(p => ({ ...p, ...changes }));
  const setAgent = (id: AgentId, status: "running" | "done" | "error", summary = "") => {
    setProject(p => ({ ...p, agentRecords: p.agentRecords.map(r => r.id === id ? { ...r, status, summary: summary.slice(0, 1800), updatedAt: Date.now() } : r) }));
  };
  const loadModel = async () => {
    setLoading(true); setProgress(0); setProgressText("Preparing WebGPU runtime…");
    try {
      await loadLocalModel(model, (text, p) => { setProgressText(text); setProgress(p); }, Number(context));
      setModelReady(true); setNotice("Local model loaded. Agents run sequentially.");
    } catch (e) { setNotice((e as Error).message); setModelReady(false); }
    finally { setLoading(false); }
  };
  const unload = async () => { await unloadModel(); setModelReady(false); setProgress(0); setProgressText("Model unloaded — GPU resources released"); setNotice("Model unloaded."); };
  const ask = async (prompt: string, streamOutput = false) => {
    if (useFallback) {
      if (!endpoint) throw new Error("Set a local OpenAI-compatible endpoint in Settings.");
      return fallbackComplete(endpoint, fallbackModel, prompt);
    }
    if (!modelReady) throw new Error("Load the local WebLLM model first, or configure the local endpoint fallback.");
    setStream("");
    return complete(prompt, token => { if (streamOutput) setStream(s => s + token); });
  };
  const runOutline = async () => {
    setBusy(true); setAgent("outline", "running"); setActiveAgent("outline");
    try {
      const raw = await ask(outlinePrompt(project));
      const parsed = parseJson<{sections: OutlineSection[]; title?: string}>(raw);
      patch({ outline: parsed.sections || [], name: parsed.title || project.name });
      setAgent("outline", "done", JSON.stringify(parsed).slice(0, 1100)); setNotice("Outline generated. Edit its sections before drafting.");
    } catch (e) { setAgent("outline", "error", (e as Error).message); setNotice((e as Error).message); }
    finally { setBusy(false); }
  };
  const runLiterature = async () => {
    setBusy(true); setAgent("literature", "running"); setActiveAgent("literature");
    try {
      const plan = parseJson<{queries: string[]}>(await ask(literatureQueryPrompt(project, project.outline)));
      const found: Paper[] = [];
      for (const query of (plan.queries || []).slice(0, 4)) {
        const result = await searchPapers(query, 4); found.push(...result.papers);
      }
      const unique = [...new Map(found.map(p => [p.title, p])).values()].slice(0, 12);
      const bib = papersToBibtex(unique);
      patch({ papers: unique, bibtex: [project.bibtex, bib].filter(Boolean).join("\n\n") });
      setAgent("literature", "done", `Retrieved ${unique.length} candidate papers. Verify metadata and relevance.`);
      setNotice(`Literature search returned ${unique.length} candidate papers.`);
    } catch (e) { setAgent("literature", "error", (e as Error).message); setNotice((e as Error).message); }
    finally { setBusy(false); }
  };
  const runPlots = async () => {
    setBusy(true); setAgent("plots", "running"); setActiveAgent("plots");
    try {
      const plan = parseJson<{x:string;y:string;title:string}>(await ask(plotPrompt(project)));
      const trimmed = project.logs.trim();
      const rows = trimmed.startsWith("[") || trimmed.startsWith("{")
        ? JSON.parse(trimmed)
        : parseCsv(trimmed);
      const result = await generatePlot(Array.isArray(rows) ? rows : rows.data, plan.x, plan.y, plan.title);
      patch({ figures: [...project.figures, { name: result.filename, png: result.png_base64, mime: result.mime_type || "image/png" }] });
      setAgent("plots", "done", `Generated ${result.filename} using ${plan.x} and ${plan.y}.`);
      setNotice("Plot generated.");
    } catch (e) { setAgent("plots", "error", (e as Error).message); setNotice((e as Error).message); }
    finally { setBusy(false); }
  };
  const runWriting = async () => {
    setBusy(true); setAgent("writing", "running"); setActiveAgent("writing");
    try {
      let latex = project.latex;
      const sections = project.outline;
      if (!sections.length) throw new Error("Generate or add an outline first.");
      for (const section of sections) {
        const body = await ask(writingPrompt({ ...project, latex }, section), true);
        latex = insertSection(latex, section.title, body);
        patch({ latex });
      }
      setAgent("writing", "done", `Drafted ${sections.length} sections sequentially.`);
      setNotice("Section drafting complete. Review every claim and citation.");
    } catch (e) { setAgent("writing", "error", (e as Error).message); setNotice((e as Error).message); }
    finally { setBusy(false); }
  };
  const runRefine = async () => {
    setBusy(true); setAgent("refine", "running"); setActiveAgent("refine");
    try {
      const result = parseJson<{issues:string[];revised_latex:string}>(await ask(refinePrompt(project)));
      patch({ latex: result.revised_latex || project.latex });
      setAgent("refine", "done", (result.issues || []).join("\n").slice(0, 1200));
      setNotice(`Refinement complete: ${(result.issues || []).length} review notes.`);
    } catch (e) { setAgent("refine", "error", (e as Error).message); setNotice((e as Error).message); }
    finally { setBusy(false); }
  };
  const runAgent = () => {
    if (busy) return;
    const actions: Record<AgentId, () => Promise<void>> = { outline: runOutline, literature: runLiterature, plots: runPlots, writing: runWriting, refine: runRefine };
    void actions[activeAgent]();
  };
  const addSection = () => patch({ outline: [...project.outline, { id: uid(), title: "New section", description: "Describe the section purpose." }] });
  const updateSection = (id: string, title: string) => patch({ outline: project.outline.map(s => s.id === id ? { ...s, title } : s) });
  const removeSection = (id: string) => patch({ outline: project.outline.filter(s => s.id !== id) });
  const selectTemplate = async (name: string) => {
    if (name === "Generic Article") {
      patch({ template: name, templateFiles: {}, latex: "\\documentclass{article}\\n\\usepackage{graphicx}\\n\\usepackage{natbib}\\n\\title{Research Manuscript}\\n\\begin{document}\\n\\maketitle\\n\\end{document}" });
      return;
    }
    const folder = name === "CVPR 2025" ? "cvpr2025" : "iclr2025";
    const fileNames = folder === "cvpr2025"
      ? ["template.tex", "preamble.tex", "cvpr.sty", "ieeenat_fullname.bst", "guidelines.md"]
      : ["template.tex", "math_commands.tex", "iclr2025_conference.sty", "natbib.sty", "fancyhdr.sty", "iclr2025_conference.bst", "guidelines.md"];
    try {
      const entries = await Promise.all(fileNames.map(async file => {
        const response = await fetch(`/templates/${folder}/${file}`);
        if (!response.ok) throw new Error(`Could not load ${file}`);
        return [file, await response.text()] as const;
      }));
      const assets = Object.fromEntries(entries);
      patch({ template: name, latex: assets["template.tex"], templateFiles: assets });
      setNotice(`${name} official template loaded. Replace the sample author details before submission.`);
      setTab("latex");
    } catch (error) {
      setNotice(`Template could not be loaded: ${(error as Error).message}`);
    }
  };
  const uploadText = async (file?: File, kind: "notes" | "logs" = "notes") => {
    if (!file) return;
    const text = await file.text();
    if (kind === "notes") patch({ notes: project.notes ? `${project.notes}\n\n${text}` : text });
    else patch({ logs: text });
    setNotice(`Imported ${file.name}`);
  };
  const doCompile = async () => {
    try {
      const result = await compileLatex(project.latex, project.bibtex, project.templateFiles || {}, project.figures);
      if (result.pdf_base64) {
        setPdf(result.pdf_base64);
        setNotice("LaTeX compilation succeeded. The compiled PDF is ready in the preview pane.");
      } else {
        setPdf(undefined);
        setNotice("Browser print preview opened. Choose Save as PDF. Connect the Railway compute engine for native LaTeX compilation.");
      }
    } catch (e) { setNotice((e as Error).message); }
  };
  const runExport = () => exportProject(project, pdf);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={17}/></div><span>paper<span className="brand-light">orchestra</span></span><span className="studio-tag">STUDIO</span></div>
      {onBack && <button className="secondary-button" onClick={onBack}><ArrowLeft size={13}/> Project workspace</button>}
      <div className="project-title"><span className="muted">PROJECT /</span> <input value={project.name} onChange={e => patch({name:e.target.value})} aria-label="Project name"/></div>
      <div className="top-actions">
        <span className={`gpu-pill ${gpu.includes("available") ? "good" : "warn"}`}><Zap size={13}/>{gpu}</span>
        <span className="telemetry"><Activity size={13}/>{tokensPerSec} tok/s</span>
        <button className="icon-button" title="Settings" onClick={() => setShowSettings(!showSettings)}><Settings2 size={16}/></button>
        <button className="secondary-button" onClick={runExport}><Download size={14}/> Export ZIP</button>
      </div>
    </header>

    {showSettings && <div className="settings-pop">
      <div className="panel-heading">Runtime settings <button className="icon-button" onClick={() => setShowSettings(false)}>×</button></div>
      <label>WebLLM model<select value={model} onChange={e => { setModel(e.target.value); if (modelReady) void unload(); }}>{MODEL_OPTIONS.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select></label>
      <label>Context window<select value={context} onChange={e => setContext(e.target.value)}><option value="8192">8,192 tokens (recommended)</option><option value="12288">12,288 tokens (higher memory)</option></select></label>
      <p className="hint">8K is recommended for 16 GB systems. 12K increases KV-cache memory use and may cause WebGPU allocation failures on integrated graphics.</p>
      <label className="checkline"><input type="checkbox" checked={useFallback} onChange={e => setUseFallback(e.target.checked)}/> Use local OpenAI-compatible endpoint</label>
      <label>Endpoint URL<input value={endpoint} onChange={e=>setEndpoint(e.target.value)} placeholder="http://localhost:11434/v1"/></label>
      <label>Model name<input value={fallbackModel} onChange={e=>setFallbackModel(e.target.value)}/></label>
      <button className="secondary-button full" onClick={unload}><Unplug size={14}/> Unload model / Free RAM</button>
    </div>}

    <div className="hardware-row">
      <div className="hardware-left"><span className="live-dot"/><span>{modelReady ? "LOCAL MODEL READY" : "LOCAL MODEL NOT LOADED"}</span><span className="muted">·</span><span className="muted">{progressText}</span></div>
      <div className="hardware-right"><div className="progress-track"><div style={{width:`${Math.round(progress*100)}%`}}/></div><span className="muted">{Math.round(progress*100)}%</span><span className="memory-est"><Gauge size={13}/> ~2.2 GB / 8.0 GB <span className="muted">estimated shared GPU budget</span></span>
      <button className="tiny-button" onClick={modelReady ? unload : loadModel} disabled={loading || useFallback}>{loading ? <Loader2 className="spin" size={13}/> : modelReady ? <Unplug size={13}/> : <BrainCircuit size={13}/>} {loading ? "Loading…" : modelReady ? "Unload" : "Load local model"}</button></div>
    </div>

    <main className="workspace">
      <aside className="left-pane">
        <div className="pane-title"><FolderOpen size={14}/> PROJECT EXPLORER <button className="icon-button small" onClick={()=>setProject(initialProject())}><Plus size={14}/></button></div>
        <div className="project-tree">
          <div className="tree-section">RESEARCH FILES</div>
          <div className="tree-item active"><FileText size={14}/> manuscript.tex <span className="file-type">TEX</span></div>
          <div className="tree-item"><BookOpen size={14}/> references.bib <span className="file-type">BIB</span></div>
          <div className="tree-item"><FileText size={14}/> research-notes.md</div>
          <div className="tree-section section-gap">DATA & FIGURES</div>
          <button className="tree-action" onClick={()=>notesRef.current?.click()}><Upload size={13}/> Import notes (.md, .txt)</button>
          <input ref={notesRef} hidden type="file" accept=".md,.txt" onChange={e=>uploadText(e.target.files?.[0],"notes")}/>
          <button className="tree-action" onClick={()=>logsRef.current?.click()}><Upload size={13}/> Import experiment data</button>
          <input ref={logsRef} hidden type="file" accept=".csv,.json" onChange={e=>uploadText(e.target.files?.[0],"logs")}/>
          {project.figures.map((f,i)=><div className="tree-item" key={i}><Image size={13}/>{f.name}</div>)}
          <div className="tree-section section-gap">CONFERENCE TEMPLATE</div>
          <select className="template-select" value={project.template} onChange={e=>void selectTemplate(e.target.value)}>{templates.map(t=><option key={t}>{t}</option>)}</select>
          <div className="tree-section section-gap">SAVED PROJECTS</div>
          {projects.slice(0,5).map(p=><button className="saved-project" key={p.id} onClick={()=>setProject(p)}>{p.name}</button>)}
        </div>
        <div className="sidebar-footer"><span className="live-dot"/><span>IndexedDB autosave enabled</span></div>
      </aside>

      <section className="center-pane">
        <div className="agent-stepper">{AGENTS.map((a,i)=><button key={a.id} className={`step ${activeAgent===a.id?"selected":""}`} onClick={()=>setActiveAgent(a.id)}>
          <span className={`step-num ${records[a.id]?.status==="done"?"complete":""}`}>{records[a.id]?.status==="done"?<Check size={12}/>:i+1}</span><span>{a.label}</span>{i<4&&<span className="step-line"/>}
        </button>)}</div>
        <div className="center-tabs">
          {(["workspace","latex","literature","plots","python"] as const).map(t=><button key={t} className={tab===t?"tab active-tab":"tab"} onClick={()=>setTab(t)}>{t==="workspace"?"Agent workspace":t==="latex"?"LaTeX editor":t==="literature"?"Literature":t==="plots"?"Plot gallery":"Python console"}</button>)}
        </div>
        <div className="center-content">
          {tab==="python" && <LocalPythonPanel/>}
          {tab==="workspace" && <>
            <div className="agent-heading"><div><div className="eyebrow">AGENT PIPELINE / {activeAgent.toUpperCase()}</div><h1>{AGENTS.find(a=>a.id===activeAgent)?.label} <span>Agent</span></h1><p>{AGENTS.find(a=>a.id===activeAgent)?.description}. Review outputs before continuing.</p></div><button className="primary-button" disabled={busy} onClick={runAgent}>{busy?<Loader2 className="spin" size={15}/>:<Play size={14}/>} Run agent</button></div>
            <div className="agent-card">
              <div className="card-top"><span className="card-title"><Sparkles size={14}/> {activeAgent==="outline"?"Research blueprint":activeAgent==="literature"?"Literature discovery":activeAgent==="plots"?"Experiment visualization":activeAgent==="writing"?"Section drafting":"Manuscript quality review"}</span><span className={`status ${records[activeAgent]?.status}`}>{records[activeAgent]?.status || "idle"}</span></div>
              {activeAgent==="outline" ? <div className="outline-list">
                {project.outline.map((s,i)=><div className="outline-row" key={s.id}><span className="drag-handle">⠿</span><span className="outline-index">{String(i+1).padStart(2,"0")}</span><input value={s.title} onChange={e=>updateSection(s.id,e.target.value)}/><button className="icon-button" onClick={()=>removeSection(s.id)}><Trash2 size={13}/></button></div>)}
                <button className="add-row" onClick={addSection}><Plus size={14}/> Add section</button>
              </div> : activeAgent==="literature" ? <div className="literature-list">
                {project.papers.map((p,i)=><div className="paper-row" key={i}><div className="paper-icon"><BookOpen size={15}/></div><div><strong>{p.title}</strong><p>{p.authors?.slice(0,4).join(", ")} {p.year?`· ${p.year}`:""}</p>{p.url&&<a href={p.url} target="_blank" rel="noreferrer">Open source ↗</a>}</div></div>)}
                {!project.papers.length&&<div className="empty-state">Searches are grounded in Semantic Scholar metadata. Run the agent to retrieve candidate papers.</div>}
              </div> : activeAgent==="plots" ? <div className="plot-grid">{project.figures.map((f,i)=><div className="plot-thumb" key={i}>{f.png&&<img src={`data:${f.mime || "image/png"};base64,${f.png}`} alt={f.name}/>}<span>{f.name}</span></div>)}{!project.figures.length&&<div className="empty-state">Import a CSV or JSON dataset, then run the plotting agent.</div>}</div> :
              <div className="empty-state">{activeAgent==="writing"?"Drafts each outline section sequentially into the LaTeX source.":"Checks LaTeX structure, citation keys, and academic tone. Review suggested edits."}</div>}
              {records[activeAgent]?.summary&&<div className="agent-summary"><strong>Latest agent summary</strong><p>{records[activeAgent].summary}</p></div>}
            </div>
            {activeAgent==="plots"&&<div className="feedback-box"><label>Regenerate with feedback</label><div><input value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="e.g. Use a log scale and emphasize the intervention period"/><button className="secondary-button" onClick={()=>{patch({notes:project.notes+"\nPlot feedback: "+feedback});void runPlots();}}><RefreshCw size={13}/> Regenerate</button></div></div>}
            <div className="runtime-log"><span className="log-label">AGENT CONSOLE</span><p>{notice}</p>{stream&&<pre>{stream.slice(-1200)}</pre>}</div>
          </>}
          {tab==="latex"&&<div className="editor-wrap"><div className="editor-toolbar"><span><FileText size={14}/> manuscript.tex</span><span className="muted">LaTeX · UTF-8</span></div><textarea className="latex-editor" spellCheck={false} value={project.latex} onChange={e=>patch({latex:e.target.value})}/></div>}
          {tab==="literature"&&<div className="editor-wrap"><div className="editor-toolbar"><span><BookOpen size={14}/> references.bib</span><span className="muted">{project.papers.length} papers</span></div><textarea className="latex-editor" spellCheck={false} value={project.bibtex} onChange={e=>patch({bibtex:e.target.value})}/></div>}
          {tab==="plots"&&<div className="plot-gallery">{project.figures.map((f,i)=><div className="plot-large" key={i}>{f.png&&<img src={`data:${f.mime || "image/png"};base64,${f.png}`} alt={f.name}/>}<span>{f.name}</span></div>)}{!project.figures.length&&<div className="empty-state">No figures yet.</div>}</div>}
        </div>
        <div className="center-footer"><span><span className="live-dot"/> {busy?"Agent running sequentially":"Ready"}</span><span>{project.latex.length.toLocaleString()} chars · Saved locally</span></div>
      </section>

      <aside className="right-pane">
        <div className="preview-header"><div><FileText size={14}/> PRINT PREVIEW</div><div className="preview-actions"><button className="icon-button" title="Print / Save PDF" onClick={doCompile}><RefreshCw size={14}/></button></div></div>
        <div className="pdf-toolbar"><span>manuscript</span><span className="muted">Browser print output</span><button className="compile-button" onClick={doCompile}>Print / Save PDF <Play size={11}/></button></div>
        <div className="pdf-view">{pdf?<iframe title="Compiled PDF" src={`data:application/pdf;base64,${pdf}#toolbar=1&view=FitH`}/>:<div className="pdf-empty"><div className="pdf-sheet"><div className="fake-line wide"/><div className="fake-line"/><div className="fake-title"/><div className="fake-line wide"/><div className="fake-line"/><div className="fake-block"/><div className="fake-line wide"/></div><strong>PDF preview</strong><p>Open a print-ready browser rendering of your manuscript. For submission-quality output, compile the exported .tex file with a TeX distribution and the official conference template.</p><button className="primary-button" onClick={doCompile}><RefreshCw size={13}/> Print / Save PDF</button></div>}</div>
        <div className="preview-bottom"><span><CircleAlert size={13}/> {pdf?"Latest build available":"Awaiting first build"}</span><span>Local compile</span></div>
      </aside>
    </main>
    <footer className="statusbar"><span>PaperOrchestra Studio <span className="muted">v0.1.0</span></span><span><span className="live-dot"/> LOCAL-FIRST WORKSPACE</span><span>WebLLM · FastAPI · IndexedDB</span></footer>
  </div>;
}
function downloadPdf(base64:string) {
  const bytes = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
  const a=document.createElement("a");a.href=url;a.download="paper.pdf";a.click();URL.revokeObjectURL(url);
}

function parseCsv(input: string): Record<string, string>[] {
  const lines = input.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const split = (line: string) => {
    const values: string[] = []; let value = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim()); return values;
  };
  const headers = split(lines[0]);
  return lines.slice(1).map(line => Object.fromEntries(split(line).map((v, i) => [headers[i] || `column_${i+1}`, v])));
}
