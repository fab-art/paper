import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, ArrowUpRight, BookOpen, Clock3, FilePlus2, FolderOpen, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";
import type { Project } from "../lib/types";
import { listProjects, saveProject, restoreProject, deleteProjectAndData } from "../lib/db";
import AuthPanel from "./AuthPanel";

const uid = () => Math.random().toString(36).slice(2, 10);
const makeProject = (name: string, question = ""): Project => ({
  id: uid(), name, notes: question ? `Research question: ${question}` : "", researchQuestion: question || undefined,
  latex: "\\documentclass{article}\n\\usepackage{graphicx}\n\\usepackage{natbib}\n\\title{Research Manuscript}\n\\begin{document}\n\\maketitle\n\\end{document}",
  bibtex: "", template: "Generic Article", outline: [], papers: [], figures: [], logs: "", templateFiles: {},
  agentRecords: [
    { id: "outline", status: "idle", summary: "", updatedAt: Date.now() },
    { id: "literature", status: "idle", summary: "", updatedAt: Date.now() },
    { id: "plots", status: "idle", summary: "", updatedAt: Date.now() },
    { id: "writing", status: "idle", summary: "", updatedAt: Date.now() },
    { id: "refine", status: "idle", summary: "", updatedAt: Date.now() }
  ], updatedAt: Date.now()
});

function relativeDate(value: number) {
  const days = Math.max(0, Math.floor((Date.now() - value) / 86400000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${new Date(value).toLocaleDateString()}`;
}

export default function Dashboard({ onOpen }: { onOpen: (project: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createDialogRef = useRef<HTMLFormElement | null>(null);
  const wasCreateOpenRef = useRef(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (error) {
      setActionError("Could not load projects: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!showCreate) {
      if (wasCreateOpenRef.current) createTriggerRef.current?.focus();
      wasCreateOpenRef.current = false;
      return;
    }

    wasCreateOpenRef.current = true;
    const dialog = createDialogRef.current;
    if (!dialog) return;

    const focusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    focusableElements()[0]?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowCreate(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleDialogKeyDown);
    return () => dialog.removeEventListener("keydown", handleDialogKeyDown);
  }, [showCreate]);

  const activeProjects = projects.filter(project => !project.archivedAt);
  const archivedProjects = projects.filter(project => Boolean(project.archivedAt));
  const scopedProjects = scope === "active" ? activeProjects : archivedProjects;
  const filtered = useMemo(() => scopedProjects.filter(project =>
    project.name.toLowerCase().includes(query.toLowerCase()) ||
    project.notes.toLowerCase().includes(query.toLowerCase()) ||
    (project.researchQuestion || "").toLowerCase().includes(query.toLowerCase())
  ), [scopedProjects, query]);
  const active = activeProjects.filter(project => project.agentRecords.some(agent => agent.status === "running")).length;
  const completed = activeProjects.filter(project => project.agentRecords.length > 0 && project.agentRecords.every(agent => agent.status === "done")).length;

  const create = async () => {
    const project = makeProject(name.trim() || "Untitled research project", question.trim());
    try {
      await saveProject(project);
      setActionError("");
      setName(""); setQuestion(""); setShowCreate(false);
      await refresh();
      onOpen(project);
    } catch (error) {
      setActionError("Could not create project: " + (error as Error).message);
    }
  };
  const archive = async (project: Project) => {
    if (!window.confirm(`Archive "${project.name}"? Its research data and files will be preserved. You can restore it later.`)) return;
    try {
      await saveProject({ ...project, archivedAt: Date.now() });
      setActionError("");
    } catch (error) {
      setActionError("Could not archive project: " + (error as Error).message);
    }
    await refresh();
  };
  const restore = async (project: Project) => {
    try {
      await restoreProject(project);
      setActionError("");
    } catch (error) {
      setActionError("Could not restore project: " + (error as Error).message);
    }
    await refresh();
  };
  const permanentlyDelete = async (project: Project) => {
    if (!window.confirm(`Permanently delete "${project.name}" and all its notes, uploaded files and search history? This cannot be undone.`)) return;
    try {
      await deleteProjectAndData(project.id, project.revision ?? 0);
      setActionError("");
    } catch (error) {
      setActionError("Could not delete project: " + (error as Error).message);
    }
    await refresh();
  };

  return <div className="dashboard-shell">
    <header className="dash-topbar">
      <div className="dash-brand"><div className="dash-mark"><Sparkles size={18}/></div><span>Paper<span>Orchestra</span></span><small>RESEARCH STATION</small></div>
      <div className="dash-top-right"><span className="dash-local"><span/> LOCAL WORKSPACE</span><AuthPanel/><button ref={createTriggerRef} className="dash-new" onClick={event => { createTriggerRef.current = event.currentTarget; setActionError(""); setShowCreate(true); }}><FilePlus2 size={15}/> New project</button></div>
    </header>
    <main className="dash-main">
      {actionError && <div role="alert" className="dash-action-error"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>Dismiss</button></div>}
      <section className="dash-welcome">
        <div><div className="dash-kicker">YOUR RESEARCH DESK</div><h1>Good research starts<br/>with a clear workspace.</h1><p>Pick up where you left off, or start a new research project.</p></div>
        <div className="dash-orbit"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core"><BookOpen size={34}/></div><span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/><span className="orbit-dot dot-c"/></div>
      </section>
      <section className="dash-stats">
        <div><span><FolderOpen size={15}/> ACTIVE PROJECTS</span><strong>{activeProjects.length}</strong><small>Saved in this browser</small></div>
        <div><span><Activity size={15}/> IN PROGRESS</span><strong>{active}</strong><small>Currently running agents</small></div>
        <div><span><Archive size={15}/> COMPLETED</span><strong>{completed}</strong><small>All five writing stages done</small></div>
      </section>
      <section className="dash-project-section">
        <div className="dash-section-head"><div><div className="dash-kicker">PROJECT LIBRARY</div><h2>{scope === "active" ? "Your research projects" : "Archived projects"}</h2></div><label className="dash-search"><Search size={15}/><input aria-label="Search projects" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/></label></div>
        <div className="dash-scope-tabs" role="group" aria-label="Project lists">
          <button type="button" aria-pressed={scope === "active"} className={scope === "active" ? "selected" : ""} onClick={() => {setScope("active");setQuery("");}}>Active <span>{activeProjects.length}</span></button>
          <button type="button" aria-pressed={scope === "archived"} className={scope === "archived" ? "selected" : ""} onClick={() => {setScope("archived");setQuery("");}}>Archived <span>{archivedProjects.length}</span></button>
        </div>
        {loading ? <div className="dash-empty">Loading your project library…</div> : filtered.length === 0 ? <div className="dash-empty"><FolderOpen size={25}/><strong>{query ? "No matching projects" : scope === "archived" ? "No archived projects" : "Your research station is ready"}</strong><p>{query ? "Try another search term." : scope === "archived" ? "Projects you archive will stay here until you restore or permanently delete them." : "Create your first project to begin collecting literature, organizing evidence and writing."}</p>{scope === "active" && <button ref={createTriggerRef} className="dash-new" onClick={event=>{createTriggerRef.current=event.currentTarget;setActionError("");setShowCreate(true);}}><FilePlus2 size={14}/> Create first project</button>}</div> :
          <div className="dash-project-grid">{filtered.map(project => {
            const done = project.agentRecords.filter(agent=>agent.status==="done").length;
            const pct = Math.round(done / 5 * 100);
            return <article className="dash-project-card" key={project.id}>
              <div className="dash-card-top"><span className="dash-card-icon"><BookOpen size={17}/></span>
                {scope === "active"
                  ? <button className="dash-delete" title="Archive project" aria-label={`Archive ${project.name}`} onClick={()=>void archive(project)}><Archive size={14}/></button>
                  : <div className="dash-archive-actions"><button className="dash-restore" title="Restore project" aria-label={`Restore ${project.name}`} onClick={()=>void restore(project)}><RotateCcw size={14}/></button><button className="dash-delete" title="Permanently delete project" aria-label={`Permanently delete ${project.name}`} onClick={()=>void permanentlyDelete(project)}><Trash2 size={14}/></button></div>}
              </div>
              <h3>{project.name}</h3><p className="dash-card-desc">{(project.researchQuestion || project.notes)?.replace(/^Research question:\\s*/i,"").slice(0,125) || "No research question or project description added yet."}</p>
              <div className="dash-progress"><div><span>WRITING WORKFLOW</span><b>{pct}%</b></div><i><span style={{width:`${pct}%`}}/></i></div>
              <div className="dash-card-foot"><span><Clock3 size={13}/>{relativeDate(project.updatedAt)}</span>{scope === "active" && <button onClick={()=>onOpen(project)}>Open project <ArrowUpRight size={14}/></button>}</div>
              {scope === "archived" && <p className="dash-archived-at">Archived {new Date(project.archivedAt || project.updatedAt).toLocaleDateString()}</p>}
            </article>;
          })}</div>}
      </section>
      <footer className="dash-footer"><span>PaperOrchestra Research Station</span><span>Private by default · Projects stored locally in this browser</span></footer>
    </main>
    {showCreate && <div className="dash-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false);}}><form ref={createDialogRef} className="dash-modal" role="dialog" aria-modal={true} aria-labelledby="dash-create-title" aria-describedby="dash-create-description" onSubmit={e=>{e.preventDefault();void create();}}>
      <div className="dash-kicker">NEW WORKSPACE</div><h2 id="dash-create-title">Create a research project</h2><p id="dash-create-description">Start with a project title. You can add the research question and materials at any time.</p>{actionError && <div role="alert" className="dash-action-error">{actionError}</div>}
      <label>Project name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Childhood immunization timeliness" /></label>
      <label>Research question <span>OPTIONAL</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What do you want to investigate?" rows={3}/></label>
      <div className="dash-modal-actions"><button type="button" className="dash-cancel" onClick={()=>setShowCreate(false)}>Cancel</button><button type="submit" className="dash-new"><FilePlus2 size={14}/> Create project</button></div>
    </form></div>}
  </div>;
}
