import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpen, Boxes, ChevronRight, FileText, FlaskConical, FolderKanban,
  GraduationCap, Layers3, Microscope, Moon, Settings2, ShieldCheck, Sparkles, Sun, Workflow
} from "lucide-react";
import { Button, Card, Sidebar } from "@santi020k/lumen-react";
import type { Project } from "../../../frontend/src/lib/types";
import { listProjects } from "./features/projects/projectRepository";
import ProjectLibrary from "./features/projects/ProjectLibrary";
import ProjectWorkspace from "./features/projects/ProjectWorkspace";
import { getWorkspaceByPath, getWorkspaceGroups, WORKSPACES } from "./domain/workspaces.mjs";

const iconByWorkspace: Record<string, typeof Activity> = {
  station: Activity, projects: FolderKanban, blueprint: Workflow, production: Boxes,
  literature: BookOpen, evidence: Microscope, writing: FileText, data: FlaskConical,
  "systematic-review": GraduationCap, quality: ShieldCheck, publication: Layers3,
  collaboration: Sparkles, settings: Settings2
};

type RouteState = { path: string; projectId: string | null };

function resolveRoute(pathname: string): RouteState {
  const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const segments = normalized.split("/");
  if (segments.length === 3 && segments[1] === "projects" && segments[2]) {
    let projectId = segments[2];
    try { projectId = decodeURIComponent(projectId); } catch { /* Keep the literal route segment. */ }
    return { path: "/projects", projectId };
  }
  return { path: normalized || "/", projectId: null };
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteState>(() => resolveRoute(window.location.pathname));
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return window.localStorage.getItem("paperorchestra-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setStorageError(null);
    try {
      setProjects(await listProjects());
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "The local research library could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  useEffect(() => {
    try {
      window.localStorage.setItem("paperorchestra-theme", theme);
    } catch {
      // Theme remains available for this session when storage is restricted.
    }
  }, [theme]);

  useEffect(() => {
    const onPopState = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const groups = useMemo(() => getWorkspaceGroups(), []);
  const activeWorkspace = getWorkspaceByPath(route.path) ?? WORKSPACES[0];

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setRoute(resolveRoute(path));
  }

  function openProject(project: Project) {
    navigate("/projects/" + encodeURIComponent(project.id));
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
          <span className={"local-status " + (storageError ? "is-error" : loading ? "is-loading" : "")}>
            <span className="status-dot" />
            {storageError ? "Local library unavailable" : loading ? "Opening local library" : "Local workspace"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={"Switch to " + (theme === "light" ? "dark" : "light") + " theme"}
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
                    className={"nav-item " + (active ? "is-active" : "")}
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
              <div className="breadcrumb"><span>Research Factory</span><ChevronRight size={13} /><span>{route.projectId ? "Projects" : activeWorkspace.label}</span></div>
              <p className="eyebrow">YOUR RESEARCH, ORCHESTRATED</p>
              <h1>{route.projectId ? "Project workspace" : activeWorkspace.label}</h1>
              <p className="page-subtitle">{route.projectId ? "A connected workspace for your research brief, sources, notes and files." : "A connected environment for every stage of the research journey."}</p>
            </div>
          </div>

          {route.projectId ? (
            <ProjectWorkspace projectId={route.projectId} onBack={() => navigate("/projects")} />
          ) : activeWorkspace.id === "station" || activeWorkspace.id === "projects" ? (
            <ProjectLibrary
              projects={projects}
              loading={loading}
              storageError={storageError}
              onOpen={openProject}
              onRefresh={refreshProjects}
            />
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
