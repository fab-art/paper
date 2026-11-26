import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, FileSearch, Save, ShieldCheck } from "lucide-react";
import type { Paper, Project, RiskJudgement, RiskOfBiasRecord, StudyExtraction } from "../../../../frontend/src/lib/types";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";
import {
  APPRAISAL_TEMPLATES, createAppraisalRecord, createExtractionRecord,
  evidencePaperKey, summarizeAppraisal, switchAppraisalTemplate, upsertEvidenceRecord, validateEvidenceEntry
} from "../domain/evidence-appraisal.mjs";

const judgementOptions: { value: RiskJudgement; label: string }[] = [
  { value: "not-assessed", label: "Not assessed" },
  { value: "low", label: "Low risk / concern" },
  { value: "some-concerns", label: "Some concerns" },
  { value: "moderate", label: "Moderate risk" },
  { value: "high", label: "High risk" },
  { value: "serious", label: "Serious risk" },
  { value: "critical", label: "Critical risk" },
  { value: "unclear", label: "Unclear" },
  { value: "not-applicable", label: "Not applicable" }
];

const extractionFields: { key: keyof StudyExtraction; label: string; placeholder: string }[] = [
  { key: "studyDesign", label: "Study design", placeholder: "e.g. Cluster-randomized controlled trial" },
  { key: "setting", label: "Setting and context", placeholder: "Country, facility, community or care setting" },
  { key: "population", label: "Population", placeholder: "Eligibility, participant characteristics and age range" },
  { key: "sampleSize", label: "Sample size", placeholder: "Total enrolled, analyzed and group sizes" },
  { key: "intervention", label: "Intervention or exposure", placeholder: "Describe intervention/exposure and duration" },
  { key: "comparator", label: "Comparator", placeholder: "Usual care, placebo, alternative exposure or none" },
  { key: "outcomes", label: "Outcomes", placeholder: "Primary and secondary outcomes with time points" },
  { key: "effectEstimate", label: "Effect estimate and uncertainty", placeholder: "Effect measure, estimate, confidence interval and p-value as reported" },
  { key: "limitations", label: "Limitations", placeholder: "Limitations reported by authors and reviewer observations" },
  { key: "funding", label: "Funding and conflicts", placeholder: "Funding source and declared conflicts of interest" }
];

export default function EvidenceWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [paperKey, setPaperKey] = useState("");
  const [extraction, setExtraction] = useState<StudyExtraction>(createExtractionRecord());
  const [appraisal, setAppraisal] = useState<RiskOfBiasRecord>(createAppraisalRecord({ title: "" }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    listLocalProjects().then(rows => {
      if (!alive) return;
      const active = rows.filter(project => !project.archivedAt);
      setProjects(active);
      setProjectId(active.find(project => (project.papers ?? []).length > 0)?.id ?? active[0]?.id ?? "");
    }).catch(reason => {
      if (alive) setError(reason instanceof Error ? reason.message : "The local research library could not be opened.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectedProject = projects.find(project => project.id === projectId) ?? null;
  const papers = selectedProject?.papers ?? [];
  const selectedPaper = papers.find(paper => evidencePaperKey(paper) === paperKey) ?? null;
  const appraisalSummary = useMemo(() => summarizeAppraisal(appraisal), [appraisal]);

  useEffect(() => {
    if (!selectedProject) {
      setPaperKey("");
      return;
    }
    const first = selectedProject.papers?.[0];
    setPaperKey(first ? evidencePaperKey(first) : "");
  }, [projectId]);

  useEffect(() => {
    if (!selectedProject || !selectedPaper) {
      setExtraction(createExtractionRecord());
      setAppraisal(createAppraisalRecord(selectedPaper ?? { title: "" }));
      return;
    }
    const key = evidencePaperKey(selectedPaper);
    setExtraction({ ...createExtractionRecord(), ...(selectedProject.systematicReview?.extraction?.[key] ?? {}) });
    setAppraisal(selectedProject.systematicReview?.riskOfBias?.[key] ?? createAppraisalRecord(selectedPaper));
    setError("");
    setNotice("");
  }, [selectedProject?.id, paperKey]);

  function changeProject(nextId: string) {
    setProjectId(nextId);
    const next = projects.find(project => project.id === nextId);
    setPaperKey(next?.papers?.[0] ? evidencePaperKey(next.papers[0]) : "");
  }

  function updateDomain(index: number, patch: Partial<RiskOfBiasRecord["domains"][number]>) {
    setAppraisal(current => ({
      ...current,
      domains: current.domains.map((domain, domainIndex) => domainIndex === index ? { ...domain, ...patch } : domain)
    }));
  }

  function changeTool(tool: string) {
    setAppraisal(current => switchAppraisalTemplate(current, selectedPaper ?? { title: "" }, tool));
  }

  async function saveEvidence() {
    if (!selectedProject || !selectedPaper) return;
    const issues = validateEvidenceEntry(extraction, appraisal);
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const nextReview = upsertEvidenceRecord(selectedProject.systematicReview, selectedPaper, {
        extraction, riskOfBias: appraisal
      }).data;
      const saved = await updateLocalProject({
        ...selectedProject,
        systematicReview: nextReview,
        updatedAt: Date.now()
      });
      if (!saved) throw new Error("The evidence record could not be saved.");
      setProjects(current => current.map(project => project.id === saved.id ? saved : project));
      setNotice("Study extraction and appraisal saved on this device.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The evidence record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="evidence-state" role="status">Opening your local evidence library…</div>;

  return (
    <section className="evidence-workspace" aria-label="Evidence extraction and appraisal">
      <div className="evidence-intro">
        <div>
          <p className="eyebrow">APPRAISE · EXTRACT · TRACE</p>
          <h2>Turn papers into auditable evidence.</h2>
          <p>Record study characteristics and document your reasoning against structured appraisal prompts. Your assessments remain researcher-led.</p>
        </div>
        <div className="evidence-intro-mark"><ShieldCheck size={27} strokeWidth={1.5} /><span>RESEARCHER CONTROLLED</span></div>
      </div>

      <div className="evidence-context">
        <label>
          <span>Research project</span>
          <select aria-label="Select research project" value={projectId} onChange={event => changeProject(event.target.value)}>
            <option value="">Choose a project</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name || "Untitled project"}</option>)}
          </select>
        </label>
        <div className="evidence-context-count"><strong>{papers.length}</strong><span>saved studies</span></div>
      </div>

      {!selectedProject ? (
        <div className="evidence-state"><BookOpen size={22} /><strong>No local projects found</strong><span>Create a project and add papers in Projects or Literature Discovery to begin appraisal.</span></div>
      ) : papers.length === 0 ? (
        <div className="evidence-state"><FileSearch size={22} /><strong>This project has no saved papers yet</strong><span>Add papers from Literature Discovery or your project library. Evidence appraisal is linked to saved project sources.</span></div>
      ) : (
        <div className="evidence-layout">
          <aside className="evidence-paper-list" aria-label="Saved studies">
            <div className="evidence-list-heading"><span>PROJECT LIBRARY</span><strong>{papers.length} studies</strong></div>
            {papers.map((paper, index) => {
              const key = evidencePaperKey(paper);
              const record = selectedProject.systematicReview?.riskOfBias?.[key];
              const summary = summarizeAppraisal(record);
              const active = key === paperKey;
              return (
                <button type="button" className={"evidence-paper-choice " + (active ? "is-active" : "")} key={key || index} onClick={() => setPaperKey(key)}>
                  <span className="evidence-paper-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="evidence-paper-choice-copy"><strong>{paper.title}</strong><small>{paper.year ?? "Year unavailable"} · {paper.authors?.slice(0, 2).join(", ") || "Authors unavailable"}</small><small>{record ? summary.assessed + "/" + summary.total + " domains assessed" : "Not yet appraised"}</small></span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              );
            })}
          </aside>

          <div className="evidence-editor">
            {selectedPaper ? (
              <>
                <header className="evidence-study-header">
                  <span className="eyebrow">SELECTED STUDY</span>
                  <h3>{selectedPaper.title}</h3>
                  <p>{selectedPaper.authors?.join(", ") || "Author details unavailable"}{selectedPaper.year ? " · " + selectedPaper.year : ""}{selectedPaper.venue ? " · " + selectedPaper.venue : ""}</p>
                  {selectedPaper.doi && <span className="evidence-doi">DOI · {selectedPaper.doi}</span>}
                </header>

                <section className="evidence-section" aria-labelledby="extraction-heading">
                  <div className="evidence-section-heading"><div><span className="eyebrow">01 / DATA CAPTURE</span><h3 id="extraction-heading">Study characteristics</h3></div><span className="evidence-section-note">Extract what the source reports</span></div>
                  <div className="evidence-extraction-grid">
                    {extractionFields.map(field => (
                      <label className="evidence-field" key={field.key}>
                        <span>{field.label}</span>
                        <textarea rows={2} value={String(extraction[field.key] ?? "")} placeholder={field.placeholder} onChange={event => setExtraction(current => ({ ...current, [field.key]: event.target.value }))} />
                      </label>
                    ))}
                    <label className="evidence-field">
                      <span>Source location / page</span>
                      <input value={extraction.sourceLocation ?? ""} placeholder="e.g. Methods, p. 4; Table 2" onChange={event => setExtraction(current => ({ ...current, sourceLocation: event.target.value }))} />
                    </label>
                    <label className="evidence-field evidence-field-wide">
                      <span>Supporting quotation or source note</span>
                      <textarea rows={2} value={extraction.supportingQuote ?? ""} placeholder="Optional short quotation or paraphrase with page reference" onChange={event => setExtraction(current => ({ ...current, supportingQuote: event.target.value }))} />
                    </label>
                  </div>
                </section>

                <section className="evidence-section" aria-labelledby="appraisal-heading">
                  <div className="evidence-section-heading"><div><span className="eyebrow">02 / CRITICAL APPRAISAL</span><h3 id="appraisal-heading">Risk-of-bias prompts</h3></div><span className="evidence-section-note">{appraisalSummary.assessed} of {appraisalSummary.total} assessed</span></div>
                  <div className="evidence-appraisal-toolbar">
                    <label><span>Prompt set</span><select aria-label="Appraisal prompt set" value={appraisal.tool} onChange={event => changeTool(event.target.value)}>{Object.keys(APPRAISAL_TEMPLATES).map(tool => <option key={tool} value={tool}>{tool}</option>)}</select></label>
                    <div className="evidence-progress" aria-label={appraisalSummary.assessed + " of " + appraisalSummary.total + " appraisal domains assessed"}><span style={{ width: (appraisalSummary.total ? appraisalSummary.assessed / appraisalSummary.total * 100 : 0) + "%" }} /></div>
                    <strong>{appraisalSummary.assessed}/{appraisalSummary.total}</strong>
                  </div>
                  <p className="evidence-method-note">These are structured prompts, not an automated score or a substitute for the official tool guidance. Select the framework that fits the study design and consult its manual before making a final judgment.</p>
                  <div className="evidence-domain-list">
                    {appraisal.domains.map((domain, index) => (
                      <article className="evidence-domain" key={domain.id}>
                        <div className="evidence-domain-top"><div><span className="evidence-domain-number">{String(index + 1).padStart(2, "0")}</span><strong>{domain.name}</strong></div><label><span className="sr-only">Judgment for {domain.name}</span><select aria-label={"Judgment for " + domain.name} value={domain.judgement} onChange={event => updateDomain(index, { judgement: event.target.value as RiskJudgement })}>{judgementOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
                        <p>{domain.guidance}</p>
                        <label className="evidence-field"><span>Rationale <em>Required when assessed</em></span><textarea rows={2} value={domain.rationale} placeholder="Explain the evidence supporting this judgment. Include uncertainty where relevant." onChange={event => updateDomain(index, { rationale: event.target.value })} /></label>
                        <div className="evidence-domain-evidence">
                          <label className="evidence-field"><span>Source location</span><input value={domain.sourceLocation ?? ""} placeholder="Page, section or table" onChange={event => updateDomain(index, { sourceLocation: event.target.value })} /></label>
                          <label className="evidence-field"><span>Supporting evidence</span><textarea rows={2} value={domain.evidenceQuote ?? ""} placeholder="Optional short quotation or evidence summary" onChange={event => updateDomain(index, { evidenceQuote: event.target.value })} /></label>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="evidence-save-bar">
                  <div><strong>Saved locally to this project</strong><span>Evidence notes remain on this device unless you choose to export or share them.</span></div>
                  <button type="button" className="evidence-save-button" onClick={() => void saveEvidence()} disabled={saving}><Save size={15} />{saving ? "Saving…" : "Save evidence record"}</button>
                </div>
              </>
            ) : <div className="evidence-state">Select a study to begin.</div>}
          </div>
        </div>
      )}

      {error && <div className="evidence-feedback is-error" role="alert">{error}</div>}
      {notice && <div className="evidence-feedback" role="status"><Check size={15} />{notice}</div>}
      <p className="evidence-integrity">Evidence integrity: record what the paper reports, distinguish author claims from reviewer interpretation, retain page-level references, and never infer missing methods or results.</p>
    </section>
  );
}
