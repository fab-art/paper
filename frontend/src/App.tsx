import { useState } from "react";
import Studio from "./components/Studio";
import Dashboard from "./components/Dashboard";
import ProjectWorkspace from "./components/ProjectWorkspace";
import type { Project } from "./lib/types";

type View = { page: "dashboard" } | { page: "project"; projectId: string } | { page: "studio"; projectId: string };

export default function App() {
  const [view, setView] = useState<View>({ page: "dashboard" });
  if (view.page === "dashboard") {
    return <Dashboard onOpen={(project: Project) => setView({ page: "project", projectId: project.id })} />;
  }
  if (view.page === "project") {
    return <ProjectWorkspace
      projectId={view.projectId}
      onBack={() => setView({ page: "dashboard" })}
      onOpenStudio={() => setView({ page: "studio", projectId: view.projectId })}
    />;
  }
  return <Studio
    key={view.projectId}
    projectId={view.projectId}
    onBack={() => setView({ page: "project", projectId: view.projectId })}
    onSelectProject={(projectId) => setView({ page: "studio", projectId })}
  />;
}
