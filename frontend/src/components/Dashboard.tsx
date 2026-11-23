import { useEffect, useMemo, useState } from "react";
import { Activity, Archive, ArrowUpRight, BookOpen, Clock3, FilePlus2, FolderOpen, Search, Sparkles, Trash2 } from "lucide-react";
import type { Project } from "../lib/types";
import { listProjects, saveProject, db } from "../lib/db";

const uid = () => Math.random().toString(36).slice(2, 10);
const makeProject = (name: string, question = ""): Project => ({
  id: uid(), name, notes: question ? `Research question: ${question}` : "", latex: "\\documentclass{article}\n\\usepackage{graphicx}\n\\usepackage{natbib}\n\\title{Research Manuscript}\n\\begin{document}\n\\maketitle\n\\end{document}",
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
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => { setLoading(true); try { setProjects(await listProjects()); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.notes.toLowerCase().includes(query.toLowerCase())), [projects, query]);
  const active = projects.filter(p => p.agentRecords.some(a => a.status === "running")).length;
  const completed = projects.filter(p => p.agentRecords.length > 0 && p.agentRecords.every(a => a.status === "done")).length;

  const create = async () => {
    const project = makeProject(name.trim() || "Untitled research project", question.trim());
    await saveProject(project);
    setName(""); setQuestion(""); setShowCreate(false);
    await refresh();
    onOpen(project);
  };
  const remove = async (project: Project) => {
    if (!window.confirm(`Move "${project.name}" to the archive? This removes it from this browser's project list.`)) return;
    await db.projects.delete(project.id);
    await refresh();
  };

  return <div className="dashboard-shell">
    <header className="dash-topbar">
      <div className="dash-brand"><div className="dash-mark"><Sparkles size={18}/></div><span>Paper<span>Orchestra</span></span><small>RESEARCH STATION</small></div>
      <div className="dash-top-right"><span className="dash-local"><span/> LOCAL WORKSPACE</span><button className="dash-new" onClick={() => setShowCreate(true)}><FilePlus2 size={15}/> New project</button></div>
    </header>
    <main className="dash-main">
      <section className="dash-welcome">
        <div><div className="dash-kicker">YOUR RESEARCH DESK</div><h1>Good research starts<br/>with a clear workspace.</h1><p>Pick up where you left off, or start a new research project.</p></div>
        <div className="dash-orbit"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core"><BookOpen size={34}/></div><span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/><span className="orbit-dot dot-c"/></div>
      </section>
      <section className="dash-stats">
        <div><span><FolderOpen size={15}/> ALL PROJECTS</span><strong>{projects.length}</strong><small>Saved in this browser</small></div>
        <div><span><Activity size={15}/> IN PROGRESS</span><strong>{active}</strong><small>Currently running agents</small></div>
        <div><span><Archive size={15}/> COMPLETED</span><strong>{completed}</strong><small>All five writing stages done</small></div>
      </section>
      <section className="dash-project-section">
        <div className="dash-section-head"><div><div className="dash-kicker">PROJECT LIBRARY</div><h2>Your research projects</h2></div><label className="dash-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/></label></div>
        {loading ? <div className="dash-empty">Loading your project library…</div> : filtered.length === 0 ? <div className="dash-empty"><FolderOpen size={25}/><strong>{query ? "No matching projects" : "Your research station is ready"}</strong><p>{query ? "Try another search term." : "Create your first project to begin collecting literature, organizing evidence and writing."}</p><button className="dash-new" onClick={()=>setShowCreate(true)}><FilePlus2 size={14}/> Create first project</button></div> :
          <div className="dash-project-grid">{filtered.map(project => {
            const done = project.agentRecords.filter(a=>a.status==="done").length;
            const pct = Math.round(done / 5 * 100);
            return <article className="dash-project-card" key={project.id}>
              <div className="dash-card-top"><span className="dash-card-icon"><BookOpen size={17}/></span><button className="dash-delete" title="Archive project" onClick={()=>void remove(project)}><Trash2 size={14}/></button></div>
              <h3>{project.name}</h3><p className="dash-card-desc">{project.notes?.replace(/^Research question:\s*/i,"").slice(0,125) || "No research question or project description added yet."}</p>
              <div className="dash-progress"><div><span>WRITING WORKFLOW</span><b>{pct}%</b></div><i><span style={{width:`${pct}%`}}/></i></div>
              <div className="dash-card-foot"><span><Clock3 size={13}/>{relativeDate(project.updatedAt)}</span><button onClick={()=>onOpen(project)}>Open project <ArrowUpRight size={14}/></button></div>
            </article>;
          })}</div>}
      </section>
      <footer className="dash-footer"><span>PaperOrchestra Research Station</span><span>Private by default · Projects stored locally in this browser</span></footer>
    </main>
    {showCreate && <div className="dash-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false);}}><form className="dash-modal" onSubmit={e=>{e.preventDefault();void create();}}>
      <div className="dash-kicker">NEW WORKSPACE</div><h2>Create a research project</h2><p>Start with a project title. You can add the research question and materials at any time.</p>
      <label>Project name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Childhood immunization timeliness" /></label>
      <label>Research question <span>OPTIONAL</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What do you want to investigate?" rows={3}/></label>
      <div className="dash-modal-actions"><button type="button" className="dash-cancel" onClick={()=>setShowCreate(false)}>Cancel</button><button type="submit" className="dash-new"><FilePlus2 size={14}/> Create project</button></div>
    </form></div>}
  </div>;
}
