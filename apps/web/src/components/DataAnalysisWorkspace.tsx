import { useEffect, useState } from "react";
import { Database, FolderOpen } from "lucide-react";
import type { Project, ProjectAttachment } from "../../../../frontend/src/lib/types";
import { listLocalProjects, listProjectAttachments } from "../adapters/legacy-projects";
import DataMethodsLab from "./DataMethodsLab";

export default function DataAnalysisWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
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
      if (active) setError(reason instanceof Error ? reason.message : "The local research library could not be opened.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setAttachments([]);
    if (!projectId) return;
    listProjectAttachments(projectId).then(records => {
      if (active) setAttachments(records);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Project attachments could not be loaded.");
    });
    return () => { active = false; };
  }, [projectId]);

  return (
    <section className="data-analysis-workspace" aria-label="Dataset analysis workspace">
      <div className="data-analysis-context">
        <div>
          <p className="eyebrow">DATA · PROFILE · VALIDATE</p>
          <h2>Research data, understood.</h2>
          <p>Inspect project datasets locally before deciding how to analyze them. Original files are never modified.</p>
        </div>
        <div className="data-analysis-local"><Database size={20}/><span>On-device analysis</span></div>
      </div>
      <div className="data-analysis-project">
        <label htmlFor="data-project-select">Research project</label>
        <select id="data-project-select" value={projectId} onChange={event => setProjectId(event.target.value)} disabled={loading || projects.length === 0}>
          {projects.length === 0 ? <option value="">No projects available</option> : projects.map(project => <option key={project.id} value={project.id}>{project.name || "Untitled project"}</option>)}
        </select>
        <span>{attachments.length} project files</span>
      </div>
      {loading ? <div className="data-analysis-state" role="status">Opening your local research library…</div> :
        error ? <div className="data-analysis-state is-error" role="alert">{error}</div> :
        projects.length === 0 ? <div className="data-analysis-state"><FolderOpen size={22}/><strong>No research projects yet</strong><span>Create a project first, then add a dataset to its Research Library.</span></div> :
        <DataMethodsLab attachments={attachments} />}
    </section>
  );
}
