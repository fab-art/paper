import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Plus, Send } from "lucide-react";
import type { Project, PublicationAuthor, PublicationPlan } from "../../../../frontend/src/lib/types";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";
import { createCoverLetter, createPublicationPlan, getPublicationReadiness, transitionPublicationStatus, updatePublicationPlan } from "../domain/scientific-publication.mjs";

function downloadText(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

const newAuthor = (corresponding = false): PublicationAuthor => ({
  id: globalThis.crypto?.randomUUID?.() ?? `author-${Math.random().toString(36).slice(2)}`,
  name: "", affiliation: "", orcid: "", corresponding
});

export default function PublicationWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [plan, setPlan] = useState<PublicationPlan | null>(null);
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    listLocalProjects().then(rows => {
      if (!active) return;
      const available = rows.filter(item => !item.archivedAt);
      setProjects(available); setProjectId(available[0]?.id ?? "");
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "The local project library could not be opened."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const project = useMemo(() => projects.find(item => item.id === projectId) ?? null, [projects, projectId]);
  useEffect(() => {
    setPlan(project ? project.publicationPlan ?? createPublicationPlan(project) : null);
    setError(""); setNotice("");
  }, [projectId]);

  const readiness = useMemo(() => project && plan ? getPublicationReadiness(project, plan) : { ready: false, missing: [] }, [project, plan]);

  function edit(patch: Partial<PublicationPlan>) {
    setPlan(current => current ? updatePublicationPlan(current, patch) : current);
    setNotice("");
  }

  async function save(next = plan) {
    if (!project || !next) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await updateLocalProject({ ...project, publicationPlan: next });
      if (!saved) throw new Error("The project changed elsewhere. Reload it before saving publication metadata.");
      setProjects(rows => rows.map(item => item.id === saved.id ? saved : item));
      setPlan(next); setNotice("Publication metadata saved locally.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Publication metadata could not be saved."); }
    finally { setSaving(false); }
  }

  function changeStatus(status: PublicationPlan["status"]) {
    if (!project || !plan) return;
    const confirmExternalSubmission = status === "submitted" && window.confirm("Have you submitted this manuscript through the journal's external submission system? This only records that event; PaperOrchestra will not submit it for you.");
    if (status === "submitted" && !confirmExternalSubmission) return;
    try {
      const next = transitionPublicationStatus(project, plan, status, { actor, confirmExternalSubmission });
      void save(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The publication status could not be changed."); }
  }

  function generateLetter() {
    if (!plan) return;
    try { edit({ coverLetter: createCoverLetter(plan) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The cover letter could not be drafted."); }
  }

  function updateAuthor(id: string, patch: Partial<PublicationAuthor>) {
    edit({ authors: (plan?.authors ?? []).map(author => author.id === id ? { ...author, ...patch } : author) });
  }

  if (loading) return <div className="publish-loading" role="status">Opening publication workspace…</div>;
  if (!project || !plan) return <div className="publish-empty"><FileText size={25}/><h2>Create a research project first</h2><p>Publication planning connects journal metadata and declarations to your local manuscript and reference library.</p></div>;

  const missingLabels: Record<string, string> = {
    "target-journal": "Target journal", "article-type": "Article type", title: "Manuscript title", abstract: "Abstract",
    keywords: "Keywords", authors: "At least one author", "corresponding-author": "Corresponding author",
    manuscript: "Manuscript draft", references: "Reference library", "ethics-declaration": "Ethics declaration",
    "funding-declaration": "Funding declaration", "conflict-of-interest": "Conflict of interest declaration", "data-availability": "Data availability statement"
  };

  return <section className="publish-workspace">
    <div className="publish-toolbar">
      <div><p className="eyebrow">PUBLISH · JOURNAL SUBMISSION</p><h2>Publication workspace</h2><p>Prepare journal-specific metadata, authorship, declarations and submission documents. Actual journal submission always happens on the journal's own platform.</p></div>
      <label className="plan-project-select">Research project<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label>
    </div>
    {error && <p className="plan-message error" role="alert">{error}</p>}
    {notice && <p className="plan-message success" role="status">{notice}</p>}
    <div className="publication-statusbar"><span className={`publication-state state-${plan.status}`}>{plan.status}</span><span>Version {plan.version}</span><span>{readiness.ready ? "Submission metadata complete" : `${readiness.missing.length} items remaining`}</span></div>
    <div className="publish-panel">
      <h3>Journal and manuscript</h3>
      <div className="publish-form-grid">
        <label>Target journal<input value={plan.targetJournal} onChange={event => edit({ targetJournal: event.target.value })} placeholder="Journal name"/></label>
        <label>Article type<select value={plan.articleType} onChange={event => edit({ articleType: event.target.value })}><option value="original-research">Original research</option><option value="systematic-review">Systematic review</option><option value="scoping-review">Scoping review</option><option value="research-protocol">Research protocol</option><option value="case-report">Case report</option><option value="short-communication">Short communication</option><option value="other">Other</option></select></label>
        <label className="full">Manuscript title<input value={plan.title} onChange={event => edit({ title: event.target.value })}/></label>
        <label className="full">Abstract<textarea rows={6} value={plan.abstract} onChange={event => edit({ abstract: event.target.value })} placeholder="Paste the journal-ready abstract"/></label>
        <label className="full">Keywords<input value={plan.keywords.join(", ")} onChange={event => edit({ keywords: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} placeholder="diabetes, digital health, systematic review"/></label>
      </div>
    </div>
    <div className="publish-panel">
      <div className="publish-panel-heading"><div><h3>Authors and affiliations</h3><p>Enter names exactly as they should appear in the submission.</p></div><button className="publish-button secondary" type="button" onClick={() => edit({ authors: [...plan.authors, newAuthor(plan.authors.length === 0)] })}><Plus size={14}/> Add author</button></div>
      {plan.authors.map((author, index) => <div className="publication-author" key={author.id}>
        <div className="publication-author-title"><strong>Author {index + 1}</strong><button type="button" className="publish-text-button" onClick={() => edit({ authors: plan.authors.filter(item => item.id !== author.id) })}>Remove</button></div>
        <div className="publish-form-grid">
          <label>Name<input value={author.name} onChange={event => updateAuthor(author.id, { name: event.target.value })}/></label>
          <label>Affiliation<input value={author.affiliation} onChange={event => updateAuthor(author.id, { affiliation: event.target.value })}/></label>
          <label>ORCID<input value={author.orcid} onChange={event => updateAuthor(author.id, { orcid: event.target.value })} placeholder="0000-0000-0000-0000"/></label>
          <label className="publication-checkbox"><input type="checkbox" checked={author.corresponding} onChange={event => edit({ authors: plan.authors.map(item => ({ ...item, corresponding: item.id === author.id ? event.target.checked : false })) })}/> Corresponding author</label>
        </div>
      </div>)}
    </div>
    <div className="publish-panel">
      <h3>Required declarations</h3>
      <div className="publish-form-grid">
        <label className="full">Ethics approval and consent<textarea rows={3} value={plan.ethicsDeclaration} onChange={event => edit({ ethicsDeclaration: event.target.value })} placeholder="Approval reference, exemption basis and consent statement"/></label>
        <label className="full">Funding statement<textarea rows={2} value={plan.fundingDeclaration} onChange={event => edit({ fundingDeclaration: event.target.value })} placeholder="Funding sources or explicit no-funding statement"/></label>
        <label className="full">Conflict of interest<textarea rows={2} value={plan.conflictOfInterest} onChange={event => edit({ conflictOfInterest: event.target.value })} placeholder="Declare competing interests or state none"/></label>
        <label className="full">Data availability<textarea rows={2} value={plan.dataAvailability} onChange={event => edit({ dataAvailability: event.target.value })} placeholder="Repository, access conditions or reason data cannot be shared"/></label>
        <label className="full">Author contributions<textarea rows={2} value={plan.authorContributions} onChange={event => edit({ authorContributions: event.target.value })} placeholder="Contribution statement using the journal's required taxonomy"/></label>
      </div>
    </div>
    <div className="publish-panel">
      <div className="publish-panel-heading"><div><h3>Submission readiness</h3><p>Metadata checks only; journal-specific requirements must still be verified.</p></div><span className={readiness.ready ? "publish-ready" : "publish-incomplete"}>{readiness.ready ? "Ready for researcher review" : "Incomplete"}</span></div>
      <ul className="publication-checklist">{Object.entries(missingLabels).map(([key, label]) => <li key={key} className={readiness.missing.includes(key) ? "missing" : "complete"}><span>{readiness.missing.includes(key) ? "○" : "✓"}</span>{label}</li>)}</ul>
      <label className="publish-reviewer">Researcher identity<input value={actor} onChange={event => setActor(event.target.value)} placeholder="Required to record status changes"/></label>
      <div className="publish-actions">
        <button type="button" className="publish-button secondary" onClick={() => void save()} disabled={saving}>Save metadata</button>
        {plan.status === "draft" && <button type="button" className="publish-button" onClick={() => changeStatus("ready")} disabled={saving || !readiness.ready || !actor.trim()}>Mark ready</button>}
        {(plan.status === "ready" || plan.status === "revision") && <button type="button" className="publish-button" onClick={() => changeStatus("submitted")} disabled={saving || !actor.trim()}><Send size={14}/> Record external submission</button>}
        {plan.status === "submitted" && <><button type="button" className="publish-button secondary" onClick={() => changeStatus("revision")} disabled={saving || !actor.trim()}>Record revision request</button><button type="button" className="publish-button" onClick={() => changeStatus("accepted")} disabled={saving || !actor.trim()}>Record acceptance</button></>}
        {plan.status === "accepted" && <button type="button" className="publish-button" onClick={() => changeStatus("published")} disabled={saving || !actor.trim()}>Record publication</button>}
      </div>
    </div>
    <div className="publish-panel">
      <div className="publish-panel-heading"><div><h3>Cover letter</h3><p>Generated from your entered metadata; review and edit before use.</p></div><button type="button" className="publish-button secondary" onClick={generateLetter}>Draft cover letter</button></div>
      <textarea className="publication-letter" rows={12} value={plan.coverLetter} onChange={event => edit({ coverLetter: event.target.value })} placeholder="Draft a journal cover letter"/>
      <div className="publish-actions">
        <button type="button" className="publish-button secondary" onClick={() => downloadText("paperorchestra-cover-letter.txt", plan.coverLetter)} disabled={!plan.coverLetter.trim()}><Download size={14}/> Export cover letter</button>
        <button type="button" className="publish-button secondary" onClick={() => downloadText("paperorchestra-submission-metadata.json", JSON.stringify({ plan, manuscriptTitle: project.name, exportedAt: new Date().toISOString() }, null, 2), "application/json")}><Download size={14}/> Export metadata JSON</button>
      </div>
    </div>
  </section>;
}
