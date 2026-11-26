import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BookOpen, Boxes, ChevronRight, FileText, FlaskConical, FolderKanban, GraduationCap, Layers3, Microscope, Moon, Search, Settings2, Sun, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { Button, Card, Sidebar } from "@santi020k/lumen-react";
import { listLocalProjects } from "./adapters/legacy-projects";
import type { Project } from "../../../frontend/src/lib/types";
import { getWorkspaceByPath, getWorkspaceGroups, WORKSPACES } from "./domain/workspaces.mjs";
import ProjectManager from "./components/ProjectManager";
import LiteratureDiscovery from "./components/LiteratureDiscovery";

const iconByWorkspace: Record<string, typeof Activity> = {
  station: Activity, projects: FolderKanban, blueprint: Workflow, production: Boxes,
  literature: BookOpen, evidence: Microscope, writing: FileText, data: FlaskConical,
  "systematic-review": GraduationCap, quality: ShieldCheck, publication: Layers3,
  collaboration: Sparkles, settings: Settings2
};

function formatDate(timestamp: number | null | undefined) {
  const date = new Date(typeof timestamp === "number" ? timestamp : Number.NaN);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState(window.location.pathname);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return window.localStorage.getItem("paperorchestra-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("paperorchestra-theme", theme);
    } catch {
      // Theme remains available for this session when storage is restricted.
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    listLocalProjects().then((records) => {
      if (!cancelled) setProjects(records);
    }).catch((error: unknown) => {
      if (!cancelled) setStorageError(error instanceof Error ? error.message : "The local research library could not be opened.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onPopState = () => { setActivePath(window.location.pathname); setSelectedProject(null); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const groups = useMemo(() => getWorkspaceGroups(), []);
  const projectRouteMatch = activePath.match(/^\/projects\/([^/]+)\/?$/);
  const projectRouteId = projectRouteMatch ? decodeURIComponent(projectRouteMatch[1]) : undefined;
  const isProjectRoute = activePath === "/projects" || Boolean(projectRouteId);
  const activeWorkspace = getWorkspaceByPath(activePath) ?? (isProjectRoute ? WORKSPACES.find(item => item.id === "projects")! : WORKSPACES[0]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = projects.filter((project) => (project.name ?? "").toLowerCase().includes(normalizedQuery));

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setActivePath(path);
    setSelectedProject(null);
  }

  return (
    <div className="factory-app" data-lumen-preset="default" data-theme={theme}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-topbar">
        <a className="wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>
          <span className="wordmark-mark"><Workflow size={18} aria-hidden="true" /></span>
          <span>paper<span className="wordmark-light">orchestra</span></span>
        </a>
        <div className="topbar-context"><span className="context-dot" /> Independent Research Factory</div>
        <div className="topbar-actions">
          <span className={`local-status ${storageError ? "is-error" : loading ? "is-loading" : ""}`}>
            <span className="status-dot" />
            {storageError ? "Local library unavailable" : loading ? "Opening local library" : "Local workspace"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </Button>
        </div>
      </header>

      <div className="app-layout">
        <Sidebar className="app-sidebar" aria-label="Research Factory navigation">
          <div className="sidebar-intro">
            <span className="sidebar-kicker">YOUR WORKSPACE</span>
            <span className="sidebar-title">Research Factory</span>
          </div>
          {Object.entries(groups).map(([group, items]) => (
            <section className="nav-group" key={group} aria-label={group}>
              <p className="nav-group-label">{group}</p>
              {items.map((workspace) => {
                const Icon = iconByWorkspace[workspace.id] ?? Activity;
                const active = activeWorkspace.id === workspace.id;
                return (
                  <button
                    className={`nav-item ${active ? "is-active" : ""}`}
                    key={workspace.id}
                    type="button"
                    onClick={() => navigate(workspace.path)}
                    aria-current={active ? "page" : undefined}
                    title={workspace.status === "planned" ? "Workspace migration planned" : undefined}
                  >
                    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                    <span>{workspace.label}</span>
                    {workspace.status === "planned" && <span className="nav-soon">Soon</span>}
                  </button>
                );
              })}
            </section>
          ))}
          <div className="sidebar-bottom">
            <div className="sidebar-tip"><Sparkles size={15} /><span>Automate the work.<br />Keep the science yours.</span></div>
            <div className="sidebar-version">RESEARCH FACTORY · PREVIEW</div>
          </div>
        </Sidebar>

        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <div className="breadcrumb"><span>Research Factory</span><ChevronRight size={13} /><span>{activeWorkspace.label}</span></div>
              <p className="eyebrow">YOUR RESEARCH, ORCHESTRATED</p>
              <h1>{selectedProject ? selectedProject.name || "Untitled project" : activeWorkspace.label}</h1>
              <p className="page-subtitle">{selectedProject ? "Project record from your existing local research library." : activeWorkspace.id === "literature" ? "Search scholarly sources, curate project libraries and export citation metadata." : "A connected environment for every stage of the research journey."}</p>
            </div>
          </div>

          {activeWorkspace.id === "literature" ? (
            <LiteratureDiscovery />
          ) : isProjectRoute ? (
            <ProjectManager projectId={projectRouteId} onNavigate={navigate} />
          ) : selectedProject ? (
            <Card className="project-detail-card">
              <div className="detail-topline"><span className="eyebrow">LOCAL PROJECT RECORD</span><span className="record-id">ID · {String(selectedProject.id ?? "unknown").slice(0, 8)}</span></div>
              <h2>{selectedProject.name || "Untitled project"}</h2>
              <p>{selectedProject.researchQuestion || "No research question has been recorded yet."}</p>
              <div className="detail-meta"><span>Updated {formatDate(selectedProject.updatedAt)}</span><span>{selectedProject.status ?? "planning"}</span></div>
              <Button variant="secondary" onClick={() => setSelectedProject(null)}>Back to project library</Button>
            </Card>
          ) : activeWorkspace.id === "station" || activeWorkspace.id === "projects" ? (
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
                  <div className="orbit-core"><Workflow size={36} strokeWidth={1.2} /></div>
                  <span className="orbit-node node-one"><BookOpen size={17} /></span>
                  <span className="orbit-node node-two"><FlaskConical size={17} /></span>
                  <span className="orbit-node node-three"><FileText size={17} /></span>
                  <span className="orbit-node node-four"><ShieldCheck size={17} /></span>
                </div>
              </section>

              <section className="library-section" aria-labelledby="library-heading">
                <div className="section-heading">
                  <div><p className="eyebrow">YOUR RESEARCH LIBRARY</p><h2 id="library-heading">Projects <span className="count-pill">{loading ? "…" : storageError ? "—" : projects.length}</span></h2></div>
                  <label className="project-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a project" aria-label="Find a project" /></label>
                </div>

                {loading ? <div className="state-panel" role="status">Opening your local research library…</div> :
                  storageError ? <div className="state-panel state-error" role="alert"><strong>Local library unavailable</strong><span>{storageError}</span><span>Your records have not been changed.</span></div> :
                  filteredProjects.length === 0 ? <div className="state-panel"><div className="empty-icon"><FolderKanban size={22} /></div><strong>{projects.length ? "No matching projects" : "Your research library is ready"}</strong><span>{projects.length ? "Try another project name." : "This Phase 1 preview is read-only. Project creation and import arrive in the next migration phase; your existing local data is preserved."}</span></div> :
                  <div className="project-grid">{filteredProjects.map((project) => (
                    <Card className="project-card" key={project.id}>
                      <div className="project-card-top"><span className="project-type"><FileText size={14} /> Research project</span><span className="project-status">{project.status ?? "planning"}</span></div>
                      <h3>{project.name || "Untitled project"}</h3>
                      <p>{project.researchQuestion || "Research question not added yet."}</p>
                      <div className="project-card-footer"><span>Updated {formatDate(project.updatedAt)}</span><Button variant="ghost" size="sm" onClick={() => setSelectedProject(project)}>Open record <ArrowRight size={14} /></Button></div>
                    </Card>
                  ))}</div>
                }
              </section>
            </>
          ) : (
            <Card className="migration-panel">
              <div className="migration-icon"><Layers3 size={22} /></div>
              <p className="eyebrow">WORKSPACE MIGRATION</p>
              <h2>{activeWorkspace.label} is on the migration roadmap.</h2>
              <p>The original implementation remains available in the current production application while this workspace is rebuilt and verified here.</p>
              <Button variant="secondary" onClick={() => navigate("/")}>Return to Research Station</Button>
            </Card>
          )}
          <footer className="page-footer"><span>PaperOrchestra Research Factory</span><span>Local-first · Researcher-controlled · Evidence-grounded</span></footer>
        </main>
      </div>
    </div>
  );
}
