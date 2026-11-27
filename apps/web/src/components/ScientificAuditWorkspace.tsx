import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import type { Project, ScientificAuditRecord } from "../../../../frontend/src/lib/types";
import { listLocalProjects, listProjectAttachments, updateLocalProject } from "../adapters/legacy-projects";
import { createScientificAudit, finalizeScientificAudit, summarizeScientificAudit, updateAuditFinding } from "../domain/scientific-publication.mjs";
import ReviewerJournalTools from "../../../../frontend/src/components/ScientificAuditWorkspace";

export default function ScientificAuditWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [audit, setAudit] = useState<ScientificAuditRecord | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, ScientificAuditRecord["findings"][number]["status"]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    listLocalProjects().then(rows => {
      if (!active) return;
      const available = rows.filter(item => !item.archivedAt);
      setProjects(available);
      setProjectId(available[0]?.id ?? "");
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "The local research library could not be opened."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const project = useMemo(() => projects.find(item => item.id === projectId) ?? null, [projects, projectId]);

  useEffect(() => {
    let active = true;
    setAudit(null); setError(""); setNotice(""); setNotes({}); setStatuses({});
    if (!project) return () => { active = false; };
    if (project.scientificAudit) {
      setAudit(project.scientificAudit);
      return () => { active = false; };
    }
    Promise.all([listProjectAttachments(project.id)]).then(([attachments]) => {
      if (active) setAudit(createScientificAudit(project, { attachments }));
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "The audit checklist could not be prepared."); });
    return () => { active = false; };
  }, [projectId]);

  const summary = useMemo(() => audit ? summarizeScientificAudit(audit) : null, [audit]);

  async function persist(next: ScientificAuditRecord) {
    if (!project) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await updateLocalProject({ ...project, scientificAudit: next });
      if (!saved) throw new Error("The project changed elsewhere. Reload it before saving the audit.");
      setProjects(rows => rows.map(item => item.id === saved.id ? saved : item));
      setAudit(next); setNotice("Scientific audit saved in the local project.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The audit could not be saved."); }
    finally { setSaving(false); }
  }

  async function reviewFinding(id: string) {
    if (!audit) return;
    try {
      const next = updateAuditFinding(audit, id, { status: statuses[id] ?? audit.findings.find(item => item.id === id)!.status, reviewer, note: notes[id] ?? audit.findings.find(item => item.id === id)!.note });
      await persist(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The finding could not be reviewed."); }
  }

  async function signOff() {
    if (!audit) return;
    try { await persist(finalizeScientificAudit(audit, { reviewer })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Audit sign-off failed."); }
  }

  if (loading) return <div className="publish-loading" role="status">Opening scientific audit…</div>;
  if (!project) return <div className="publish-empty"><ShieldCheck size={25}/><h2>Create a research project first</h2><p>Scientific Audit reviews protocol, evidence, methods, ethics and manuscript traceability for a selected project.</p></div>;

  return <section className="publish-workspace">
    <div className="publish-toolbar">
      <div><p className="eyebrow">PUBLISH · QUALITY ASSURANCE</p><h2>Scientific audit</h2><p>A structured researcher-led review of evidence provenance, protocol alignment, methods, ethics and reporting. This is a checklist, not an automated scientific quality score.</p></div>
      <label className="plan-project-select">Research project<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label>
    </div>
    {error && <p className="plan-message error" role="alert">{error}</p>}
    {notice && <p className="plan-message success" role="status">{notice}</p>}
    {!audit ? <div className="publish-empty"><p>Preparing audit checklist…</p></div> : <>
      <div className="publish-metrics">
        <div><strong>{summary?.total ?? 0}</strong><span>Checklist items</span></div>
        <div><strong>{summary?.reviewed ?? 0}</strong><span>Reviewed</span></div>
        <div><strong>{summary?.needsAttention ?? 0}</strong><span>Need attention</span></div>
        <div><strong>{summary?.unreviewed ?? 0}</strong><span>Unreviewed</span></div>
      </div>
      <div className="publish-reviewer"><label>Reviewer name or ID<input value={reviewer} onChange={event => setReviewer(event.target.value)} placeholder="Required for every audit decision"/></label>{audit.signoff && <span className="publish-signed">Signed by {audit.signoff.reviewer}</span>}</div>
      {audit.findings.map(item => <article className="publish-finding" key={item.id}>
        <div className="publish-finding-heading"><div><span className="publish-category">{item.category}</span><h3>{item.title}</h3></div><span className={`publish-severity severity-${item.severity}`}>{item.severity}</span></div>
        <p>{item.description}</p><small>Evidence source: {item.source}</small>
        <div className="publish-finding-controls">
          <label>Review outcome<select value={statuses[item.id] ?? item.status} onChange={event => setStatuses(current => ({ ...current, [item.id]: event.target.value as ScientificAuditRecord["findings"][number]["status"] }))}>
            <option value="not-reviewed">Not reviewed</option><option value="verified">Verified by reviewer</option><option value="needs-attention">Needs attention</option><option value="not-applicable">Not applicable</option>
          </select></label>
          <label className="publish-note">Reviewer note<textarea rows={2} value={notes[item.id] ?? item.note} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Record evidence checked, concerns or reason for N/A"/></label>
          <button type="button" className="publish-button secondary" disabled={saving || !reviewer.trim() || (statuses[item.id] ?? item.status) === "not-reviewed"} onClick={() => void reviewFinding(item.id)}>Save review</button>
        </div>
      </article>)}
      <div className="publish-signoff"><p>Sign-off records that a named researcher reviewed every checklist item. It does not certify the study as valid or replace institutional or peer review.</p><button type="button" className="publish-button" disabled={saving || !reviewer.trim() || summary?.unreviewed !== 0 || Boolean(audit.signoff)} onClick={() => void signOff()}><ClipboardCheck size={15}/> Sign off audit</button></div>
    </>}
    <details className="publish-advanced-tools">
      <summary>Reviewer simulator and journal-fit advisor</summary>
      <p className="page-subtitle">These tools inspect the same local project record. Reviewer perspectives are simulated, and journal metadata must be independently verified before relying on it.</p>
      <ReviewerJournalTools project={project}/>
    </details>
  </section>;
}
