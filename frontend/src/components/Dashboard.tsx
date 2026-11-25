import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Progress } from "@santi020k/lumen-react";
import { Activity, Archive, ArrowUpRight, BookOpen, Clock3, FilePlus2, FolderOpen, RotateCcw, Search, Sparkles, Trash2, X, ShieldCheck } from "lucide-react";
import type { Project } from "../lib/types";
import { listProjects, saveProject, restoreProject, deleteProjectAndData } from "../lib/db";
import AuthPanel from "./AuthPanel";
import "./dashboard-intake.css";
import { buildResearchIntake, PAPER_TYPE_BLUEPRINTS } from "../lib/research-intake";
import type { ResearchPaperType } from "../lib/research-blueprint";

const uid = () => Math.random().toString(36).slice(2, 10);
const makeProject = (intake: ReturnType<typeof buildResearchIntake>): Project => ({
  id: uid(), name: intake.title, notes: intake.description ? `Research context: ${intake.description}` : "", researchQuestion: intake.researchQuestion || undefined,
  paperType: intake.paperType, intendedAudience: intake.intendedAudience,
  availableMaterials: intake.availableMaterials, storyArc: intake.storyArc, researchMode: intake.researchMode,
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
  const [problem, setProblem] = useState("");
  const [audience, setAudience] = useState("");
  const [materials, setMaterials] = useState("");
  const [paperType, setPaperType] = useState<ResearchPaperType>("unspecified");
  const [intakeStep, setIntakeStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const clearProjectSearch = () => {
    setQuery("");
    searchInputRef.current?.focus();
  };
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
  const runningAgents = activeProjects.reduce((total, project) => total + project.agentRecords.filter(agent => agent.status === "running").length, 0);
  const completed = activeProjects.filter(project => project.agentRecords.length > 0 && project.agentRecords.every(agent => agent.status === "done")).length;
  const intakePreview = buildResearchIntake({
    title: name, problemOrObservation: problem || question, researchQuestion: question,
    intendedAudience: audience, availableMaterials: materials.split(/[,;\\n]/), paperType
  });

  const create = async () => {
    const intake = buildResearchIntake({
      title: name,
      problemOrObservation: problem || question,
      researchQuestion: question,
      intendedAudience: audience,
      availableMaterials: materials.split(/[,;\\n]/),
      paperType
    });
    const project = makeProject(intake);
    try {
      await saveProject(project);
      setActionError("");
      setName(""); setQuestion(""); setProblem(""); setAudience(""); setMaterials(""); setPaperType("unspecified"); setIntakeStep(0); setShowCreate(false);
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
      <div className="dash-top-right"><Badge variant="success" className="dash-local"><span aria-hidden="true" /> LOCAL WORKSPACE</Badge><AuthPanel/><Button ref={createTriggerRef} type="button" variant="default" size="sm" className="dash-new" onClick={event => { createTriggerRef.current = event.currentTarget; setActionError(""); setIntakeStep(0); setShowCreate(true); }}><FilePlus2 size={15}/> New project</Button></div>
    </header>
    <main className="dash-main">
      {actionError && <div role="alert" className="dash-action-error"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>Dismiss</button></div>}
      <section className="dash-welcome">
        <div className="dash-welcome-copy"><div className="dash-kicker">YOUR RESEARCH DESK</div><h1>Good research starts<br/>with a clear workspace.</h1><p>Pick up where you left off, or start a new research project.</p><div className="dash-welcome-note"><span className="dash-welcome-note-dot"/> A considered space for every stage of discovery</div></div>
        <div className="dash-orbit"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core"><BookOpen size={34}/></div><span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/><span className="orbit-dot dot-c"/></div>
      </section>
      <section className="dash-stats">
        <div><span><FolderOpen size={15}/> ACTIVE PROJECTS</span><strong>{activeProjects.length}</strong><small>Saved in this browser</small></div>
        <div><span><Activity size={15}/> RUNNING AGENTS</span><strong>{runningAgents}</strong><small>Across active projects</small></div>
        <div><span><Archive size={15}/> COMPLETED PROJECTS</span><strong>{completed}</strong><small>All recorded stages finished</small></div>
      </section>
      <section className="dash-project-section">
        <div className="dash-section-head"><div><div className="dash-kicker">PROJECT LIBRARY</div><h2>{scope === "active" ? "Your research projects" : "Archived projects"}</h2></div><label className="dash-search"><Search size={15}/><input ref={searchInputRef} aria-label="Search projects" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects"/>{query && <button type="button" className="dash-search-clear" aria-label="Clear project search" onClick={clearProjectSearch}><X size={14}/></button>}</label></div>
        <div className="dash-scope-tabs" role="group" aria-label="Project lists">
          <button type="button" aria-pressed={scope === "active"} className={scope === "active" ? "selected" : ""} onClick={() => {setScope("active");setQuery("");}}>Active <span>{activeProjects.length}</span></button>
          <button type="button" aria-pressed={scope === "archived"} className={scope === "archived" ? "selected" : ""} onClick={() => {setScope("archived");setQuery("");}}>Archived <span>{archivedProjects.length}</span></button>
        </div>
        {loading ? <div className="dash-empty">Loading your project library…</div> : filtered.length === 0 ? <div className="dash-empty"><FolderOpen size={25}/><strong>{query ? "No matching projects" : scope === "archived" ? "No archived projects" : "Your research station is ready"}</strong><p>{query ? <><span>Try another search term.</span><button type="button" className="dash-empty-clear" onClick={clearProjectSearch}>Clear search</button></> : scope === "archived" ? "Projects you archive will stay here until you restore or permanently delete them." : "Create your first project to begin collecting literature, organizing evidence and writing."}</p>{scope === "active" && <Button ref={createTriggerRef} type="button" variant="default" size="sm" className="dash-new" onClick={event=>{createTriggerRef.current=event.currentTarget;setActionError("");setIntakeStep(0);setShowCreate(true);}}><FilePlus2 size={14}/> Create first project</Button>}</div> :
          <div className="dash-project-grid">{filtered.map(project => {
            const done = project.agentRecords.filter(agent=>agent.status==="done").length;
            const totalStages = project.agentRecords.length || 1;
            const pct = Math.round(done / totalStages * 100);
            return <Card as="article" variant="unstyled" className="dash-project-card" key={project.id}>
              <div className="dash-card-top"><span className="dash-card-icon"><BookOpen size={17}/></span>
                {scope === "active"
                  ? <button className="dash-delete" title="Archive project" aria-label={`Archive ${project.name}`} onClick={()=>void archive(project)}><Archive size={14}/></button>
                  : <div className="dash-archive-actions"><button className="dash-restore" title="Restore project" aria-label={`Restore ${project.name}`} onClick={()=>void restore(project)}><RotateCcw size={14}/></button><button className="dash-delete" title="Permanently delete project" aria-label={`Permanently delete ${project.name}`} onClick={()=>void permanentlyDelete(project)}><Trash2 size={14}/></button></div>}
              </div>
              <h3>{project.name}</h3><p className="dash-card-desc">{(project.researchQuestion || project.notes)?.replace(/^Research question:\\s*/i,"").slice(0,125) || "No research question or project description added yet."}</p>
              <div className="dash-progress"><div><span>WORKFLOW COMPLETION</span><b>{pct}%</b></div><Progress className="dash-lumen-progress" aria-label={`${project.name} workflow completion`} value={pct} max={100} /></div>
              <div className="dash-card-foot"><span><Clock3 size={13}/>{relativeDate(project.updatedAt)}</span>{scope === "active" && <Button type="button" variant="ghost" size="sm" className="dash-open-project" onClick={()=>onOpen(project)}>Open project <ArrowUpRight size={14}/></Button>}</div>
              {scope === "archived" && <p className="dash-archived-at">Archived {new Date(project.archivedAt || project.updatedAt).toLocaleDateString()}</p>}
            </Card>;
          })}</div>}
      </section>
      <footer className="dash-footer"><span>PaperOrchestra Research Station</span><span>Private by default · Projects stored locally in this browser</span></footer>
    </main>
    {showCreate && <div className="dash-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false);}}><form ref={createDialogRef} className="dash-modal" role="dialog" aria-modal={true} aria-labelledby="dash-create-title" aria-describedby="dash-create-description" onSubmit={e=>{e.preventDefault();if(intakeStep<2)setIntakeStep(step=>step+1);else void create();}}>
      <div className="dash-kicker">RESEARCH GPS · STEP {intakeStep+1} OF 3</div>
      <h2 id="dash-create-title">{intakeStep===0?"Start with your idea":intakeStep===1?"Choose your research route":"Review your starting brief"}</h2>
      <p id="dash-create-description">{intakeStep===0?"Tell us what brought you here. Everyday language is perfect.":intakeStep===1?"Choose the closest paper type and tell us what resources you already have.":"This is a draft starting point, not an approved protocol. You can edit it at any time."}</p>
      <div className="dash-intake-progress"><Progress value={(intakeStep+1)/3*100} max={100} aria-label={`Research intake step ${intakeStep+1} of 3`}/><div><span aria-current={intakeStep===0?"step":undefined}>1 · Your idea</span><span aria-current={intakeStep===1?"step":undefined}>2 · Your materials</span><span aria-current={intakeStep===2?"step":undefined}>3 · Review</span></div></div>
      {actionError && <div role="alert" className="dash-action-error">{actionError}</div>}
      {intakeStep===0 && <>
        <label>Project name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Childhood immunization timeliness"/></label>
        <label>What problem or observation brought you here?<textarea value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Describe the issue, observation or idea in your own words." rows={3}/></label>
        <label>What do you want to find out? <span>OPTIONAL · YOU CAN REFINE THIS LATER</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What question would you like this research to answer?" rows={2}/></label>
      </>}
      {intakeStep===1 && <>
        <label>What kind of research are you preparing?<select value={paperType} onChange={e=>setPaperType(e.target.value as ResearchPaperType)}>{PAPER_TYPE_BLUEPRINTS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><small>{PAPER_TYPE_BLUEPRINTS.find(item=>item.id===paperType)?.description}</small><small>Typical first outputs: {PAPER_TYPE_BLUEPRINTS.find(item=>item.id===paperType)?.firstOutputs.join(" · ")}</small></label>
        <label>Who should care about the answer? <span>OPTIONAL</span><input value={audience} onChange={e=>setAudience(e.target.value)} placeholder="e.g. clinicians, patients, policy makers"/></label>
        <label>What do you already have? <span>OPTIONAL · SEPARATE WITH COMMAS</span><input value={materials} onChange={e=>setMaterials(e.target.value)} placeholder="e.g. PDFs, spreadsheet, existing manuscript, no data yet"/></label>
      </>}
      {intakeStep===2 && <>
        <div className="dash-intake-review"><span className="dash-kicker">PROJECT</span><strong>{intakePreview.title}</strong><p>{intakePreview.description || "No background description added yet."}</p><div><span>Research format</span><b>{PAPER_TYPE_BLUEPRINTS.find(item=>item.id===paperType)?.label}</b></div><div><span>Research question</span><b>{intakePreview.researchQuestion || "To be refined with you"}</b></div><div><span>Audience</span><b>{intakePreview.intendedAudience || "Not specified yet"}</b></div><div><span>Available materials</span><b>{intakePreview.availableMaterials.join(", ") || "Not specified yet"}</b></div></div>
        <div className="dash-intake-story"><strong>Draft research story arc</strong><ol>{intakePreview.storyArc.map((item,index)=><li key={index}>{item}</li>)}</ol></div>
        <div className="dash-intake-note"><ShieldCheck size={14}/> Your answers create a draft brief only. Research questions, methods, inclusion decisions, conclusions and ethics declarations remain yours to approve.</div>
      </>}
      <div className="dash-modal-actions">
        <Button type="button" variant="outline" size="sm" className="dash-cancel" onClick={()=>{if(intakeStep>0)setIntakeStep(step=>step-1);else setShowCreate(false);}}>{intakeStep===0?"Cancel":"Back"}</Button>
        <Button type="submit" size="sm" className="dash-new">{intakeStep===2?<><FilePlus2 size={14}/> Create project</>:<>Continue <ArrowUpRight size={14}/></>}</Button>
      </div>
    </form></div>}
  </div>;
}
