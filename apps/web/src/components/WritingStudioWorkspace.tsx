import { useEffect, useState } from "react";
import { FileText, FolderOpen, Sparkles } from "lucide-react";
import { listLocalProjects } from "../adapters/legacy-projects";
import type { Project } from "../../../../frontend/src/lib/types";
import Studio from "./Studio";

export default function WritingStudioWorkspace({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listLocalProjects().then(records => {
      if (!active) return;
      const available = records.filter(project => !project.archivedAt);
      setProjects(available);
      setProjectId(available[0]?.id ?? "");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Your local project library could not be opened.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="writing-entry-state" role="status">Opening your local manuscripts…</div>;
  if (error) return <div className="writing-entry-state is-error" role="alert">{error}</div>;
  if (!projectId) return (
    <section className="writing-entry-empty">
      <div className="writing-entry-icon"><FileText size={22}/></div>
      <p className="eyebrow">MANUSCRIPT WORKSPACE</p>
      <h2>Start with a research project.</h2>
      <p>Writing Studio works directly with your existing project records. Create or import a project first; your manuscript, notes and references will remain in your local library.</p>
      <button type="button" className="writing-entry-action" onClick={() => onNavigate("/projects")}><FolderOpen size={15}/> Open Projects</button>
    </section>
  );

  return <div className="writing-studio-route">
    <Studio projectId={projectId} onBack={() => onNavigate("/projects")} onSelectProject={setProjectId}/>
  </div>;
}
