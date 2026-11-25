import { useMemo, useState } from "react";
import { ArrowRight, FileText, FolderKanban, Plus, Search, Sparkles } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Project } from "../../../../../frontend/src/lib/types";
import type { ResearchPaperType } from "../../../../../frontend/src/lib/research-blueprint";
import {
  archiveProject, createProject, permanentlyDeleteProject, restoreArchivedProject
} from "./projectRepository";
import "./project-library.css";

function formatDate(timestamp: number | null | undefined) {
  const date = new Date(typeof timestamp === "number" ? timestamp : Number.NaN);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function ProjectLibrary({
  projects,
  loading,
  storageError,
  onOpen,
  onRefresh
}: {
  projects: Project[];
  loading: boolean;
  storageError: string | null;
  onOpen: (project: Project) => void;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [paperType, setPaperType] = useState<ResearchPaperType>("unspecified");
  const [researchMode, setResearchMode] = useState<"guided" | "professional">("guided");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  const activeProjects = useMemo(() => projects.filter((project) => !project.archivedAt), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => Boolean(project.archivedAt)), [projects]);
  const scopedProjects = scope === "active" ? activeProjects : archivedProjects;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = scopedProjects.filter((project) =>
    (project.name ?? "").toLowerCase().includes(normalizedQuery) ||
    (project.researchQuestion ?? "").toLowerCase().includes(normalizedQuery)
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setActionError("");
    try {
      const project = await createProject({
        name,
        researchQuestion,
        description,
        paperType,
        researchMode
      });
      await onRefresh();
      setShowCreate(false);
      setName("");
      setResearchQuestion("");
      setDescription("");
      setPaperType("unspecified");
      setResearchMode("guided");
      onOpen(project);
    } catch (error) {
      setActionError((error as Error).message || "The project could not be created.");
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (project: Project) => {
    if (!window.confirm(`Archive “${project.name}”? You can restore it later.`)) return;
    setActionError("");
    try {
      await archiveProject(project);
      await onRefresh();
    } catch (error) {
      setActionError((error as Error).message || "The project could not be archived.");
    }
  };

  const handleRestore = async (project: Project) => {
    setActionError("");
    try {
      await restoreArchivedProject(project);
      await onRefresh();
      setScope("active");
    } catch (error) {
      setActionError((error as Error).message || "The project could not be restored.");
    }
  };

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `Permanently delete “${project.name}” and all of its notes, files, sources and research data? This cannot be undone.`
    );
    if (!confirmed) return;
    setActionError("");
    try {
      await permanentlyDeleteProject(project);
      await onRefresh();
    } catch (error) {
      setActionError((error as Error).message || "The project could not be permanently deleted.");
    }
  };

  return (
    <>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-label"><Sparkles size={14} /> A BETTER WAY TO DO RESEARCH</span>
          <h2>From research question<br />to a defensible paper.</h2>
          <p>Your existing tools stay available while each research station is migrated into this connected workspace.</p>
          <div className="welcome-footnote"><span className="status-dot" /> Your projects stay on this device by default.</div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="orbit-core"><FolderKanban size={36} strokeWidth={1.2} /></div>
          <span className="orbit-node node-one"><FileText size={17} /></span>
          <span className="orbit-node node-two"><Search size={17} /></span>
          <span className="orbit-node node-three"><FolderKanban size={17} /></span>
          <span className="orbit-node node-four"><Sparkles size={17} /></span>
        </div>
      </section>

      <section className="library-section" aria-labelledby="library-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR RESEARCH LIBRARY</p>
            <h2 id="library-heading">
              Projects <span className="count-pill">{loading ? "…" : storageError ? "—" : scope === "active" ? activeProjects.length : archivedProjects.length}</span>
            </h2>
          </div>
          <div className="project-library-actions">
            <label className="project-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a project" aria-label="Find a project" /></label>
            {scope === "active" && <Button onClick={() => { setShowCreate((value) => !value); setActionError(""); }} disabled={Boolean(storageError)}><Plus size={15} /> New project</Button>}
          </div>
        </div>

        <div className="project-scope-tabs" role="group" aria-label="Project library filter">
          <Button size="sm" variant={scope === "active" ? "primary" : "ghost"} onClick={() => setScope("active")}>Active ({activeProjects.length})</Button>
          <Button size="sm" variant={scope === "archived" ? "primary" : "ghost"} onClick={() => setScope("archived")}>Archived ({archivedProjects.length})</Button>
        </div>

        {actionError && <div className="state-panel state-error" role="alert">{actionError}</div>}

        {showCreate && (
          <Card className="create-project-panel">
            <div className="project-card-heading"><div><span className="project-card-kicker">NEW RESEARCH PROJECT</span><h2>Start with the research brief</h2></div></div>
            <form className="create-project-form" onSubmit={(event) => void handleCreate(event)}>
              <label className="project-field"><span>Project name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={180} required autoFocus placeholder="e.g. Diabetes treatment response in Rwanda" /></label>
              <label className="project-field"><span>Research question</span><textarea rows={2} value={researchQuestion} onChange={(event) => setResearchQuestion(event.target.value)} placeholder="What do you want this research to answer?" /></label>
              <label className="project-field"><span>Research context</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What prompted this project? What do you already know?" /></label>
              <div className="create-project-options">
                <label className="project-field"><span>Paper type</span><select value={paperType} onChange={(event) => setPaperType(event.target.value as ResearchPaperType)}>
                  <option value="unspecified">Not decided yet</option>
                  <option value="empirical-study">Empirical study</option>
                  <option value="systematic-review">Systematic review</option>
                  <option value="scoping-review">Scoping review</option>
                  <option value="case-report">Case report</option>
                  <option value="conference-paper">Conference paper</option>
                  <option value="research-protocol">Research protocol</option>
                  <option value="dataset-analysis">Dataset analysis</option>
                  <option value="existing-manuscript">Existing manuscript</option>
                  <option value="other">Other</option>
                </select></label>
                <label className="project-field"><span>Workspace mode</span><select value={researchMode} onChange={(event) => setResearchMode(event.target.value as "guided" | "professional")}>
                  <option value="guided">Guided — step by step</option>
                  <option value="professional">Professional — full controls</option>
                </select></label>
              </div>
              <div className="project-form-actions">
                <Button type="submit" disabled={!name.trim() || creating}>{creating ? "Creating…" : "Create project"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? <div className="state-panel" role="status">Opening your local research library…</div> :
          storageError ? <div className="state-panel state-error" role="alert"><strong>Local library unavailable</strong><span>{storageError}</span><span>Your records have not been changed.</span></div> :
          visibleProjects.length === 0 ? <div className="state-panel"><div className="empty-icon"><FolderKanban size={22} /></div><strong>{normalizedQuery ? "No matching projects" : scope === "archived" ? "No archived projects" : "Start your first research project"}</strong><span>{normalizedQuery ? "Try another project name or research question." : scope === "archived" ? "Projects you archive will appear here and can be restored." : "Create a project to begin. Your records stay in this browser unless you explicitly enable collaboration."}</span>{scope === "active" && !normalizedQuery && <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create project</Button>}</div> :
          <div className="project-grid">{visibleProjects.map((project) => (
            <Card className="project-card" key={project.id}>
              <div className="project-card-top"><span className="project-type"><FileText size={14} /> Research project</span><span className="project-status">{project.archivedAt ? "archived" : project.status ?? "planning"}</span></div>
              <h3>{project.name || "Untitled project"}</h3>
              <p>{project.researchQuestion || "Research question not added yet."}</p>
              <div className="project-card-footer"><span>Updated {formatDate(project.updatedAt)}</span><div className="project-card-actions">
                <Button variant="ghost" size="sm" onClick={() => onOpen(project)}>Open <ArrowRight size={14} /></Button>
                {scope === "active"
                  ? <Button variant="ghost" size="sm" onClick={() => void handleArchive(project)}>Archive</Button>
                  : <><Button variant="ghost" size="sm" onClick={() => void handleRestore(project)}>Restore</Button><Button variant="ghost" size="sm" onClick={() => void handleDelete(project)}>Delete permanently</Button></>}
              </div></div>
            </Card>
          ))}</div>
        }
      </section>
    </>
  );
}
