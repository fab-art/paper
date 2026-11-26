import { useEffect, useMemo, useState } from "react";
import { BookOpen, LoaderCircle } from "lucide-react";
import type { Project } from "../../../../frontend/src/lib/types";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";
import LegacySystematicReviewWorkspace from "../../../../frontend/src/components/SystematicReviewWorkspace";

export default function SystematicReviewsWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    listLocalProjects().then(rows => {
      if (!active) return;
      const available = rows.filter(project => !project.archivedAt);
      setProjects(available);
      setProjectId(available.find(project => (project.papers ?? []).length > 0)?.id ?? available[0]?.id ?? "");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The local research library could not be opened.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const project = useMemo(() => projects.find(item => item.id === projectId) ?? null, [projects, projectId]);

  async function updateProject(changes: Partial<Project>) {
    if (!project) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await updateLocalProject({ ...project, ...changes });
      if (!saved) throw new Error("The project changed elsewhere or could not be saved. Reload it before continuing.");
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      setNotice("Systematic review changes saved locally.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Systematic review changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="plan-section"><p>Opening your local research library…</p></section>;

  return <section className="plan-workspace systematic-reviews-workspace">
    <div className="plan-toolbar">
      <div>
        <p className="eyebrow">RESEARCH METHODS · PRISMA WORKFLOW</p>
        <h2>Systematic review management</h2>
        <p>Build a reproducible protocol, screen studies, extract evidence and record risk-of-bias judgements. Decisions remain researcher-led.</p>
      </div>
      <label className="plan-project-select">Active research project
        <select value={projectId} onChange={event => { setProjectId(event.target.value); setError(""); setNotice(""); }} aria-label="Active research project">
          <option value="">Select a project</option>
          {projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}
        </select>
      </label>
    </div>
    {error && <p className="plan-message error" role="alert">{error}</p>}
    {notice && <p className="plan-message success" role="status">{notice}</p>}
    {saving && <p className="plan-footnote" role="status"><LoaderCircle size={13} /> Saving review records locally…</p>}
    {!project ? <div className="plan-section plan-empty">
      <BookOpen size={24}/>
      <h2>Start with a research project</h2>
      <p>Create a project and add papers in Literature Discovery or Projects. Your review protocol, screening decisions and extractions will be stored with that project on this device.</p>
    </div> : <>
      {(project.papers ?? []).length === 0 && <p className="plan-message">This project has no papers yet. Add records in Literature Discovery or Projects before screening.</p>}
      <LegacySystematicReviewWorkspace key={project.id} project={project} onUpdate={updateProject}/>
    </>}
  </section>;
}
