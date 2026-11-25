import { lazy, Suspense, useState } from "react";
import Dashboard from "./components/Dashboard";
import type { Project } from "./lib/types";

const ProjectWorkspace = lazy(() => import("./components/ProjectWorkspace"));
const Studio = lazy(() => import("./components/Studio"));

type View = { page: "dashboard" } | { page: "project"; projectId: string } | { page: "studio"; projectId: string };

function WorkspaceLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" role="status" aria-live="polite">
      <p className="text-sm text-slate-500">Loading research workspace…</p>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<View>({ page: "dashboard" });
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      {view.page === "dashboard" ? (
        <Dashboard onOpen={(project: Project) => setView({ page: "project", projectId: project.id })} />
      ) : view.page === "project" ? (
        <ProjectWorkspace
          projectId={view.projectId}
          onBack={() => setView({ page: "dashboard" })}
          onOpenStudio={() => setView({ page: "studio", projectId: view.projectId })}
        />
      ) : (
        <Studio
          key={view.projectId}
          projectId={view.projectId}
          onBack={() => setView({ page: "project", projectId: view.projectId })}
          onSelectProject={(projectId) => setView({ page: "studio", projectId })}
        />
      )}
    </Suspense>
  );
}
