import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, Save, ShieldCheck } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Project } from "../../../../frontend/src/lib/types";
import type { ResearchBlueprint } from "../../../../frontend/src/lib/research-blueprint";
import { listLocalProjects, updateLocalProject, loadResearchBlueprint, saveResearchBlueprint } from "../adapters/legacy-projects";
import { approveResearchBlueprint, createResearchBlueprint, normalizeResearchBlueprint, updateResearchBlueprint, validateResearchBlueprint } from "../domain/research-orchestration.mjs";

const paperTypes = [
  ["unspecified", "Choose a research type"], ["empirical-study", "Empirical study"], ["systematic-review", "Systematic review"],
  ["scoping-review", "Scoping review"], ["case-report", "Case report"], ["conference-paper", "Conference paper"],
  ["research-protocol", "Research protocol"], ["dataset-analysis", "Dataset analysis"], ["existing-manuscript", "Existing manuscript"], ["other", "Other"]
] as const;

export default function ResearchBlueprintWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [blueprint, setBlueprint] = useState<ResearchBlueprint | null>(null);
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
      setProjectId(available[0]?.id ?? "");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The local project library could not be opened.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const project = useMemo(() => projects.find(item => item.id === projectId) ?? null, [projects, projectId]);
  useEffect(() => {
    let active = true;
    setBlueprint(null);
    setError("");
    setNotice("");
    if (!project) return () => { active = false; };
    loadResearchBlueprint(project.id).then(loaded => {
      if (active) setBlueprint(normalizeResearchBlueprint(project, loaded));
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The research blueprint could not be opened.");
    });
    return () => { active = false; };
  }, [projectId]);

  const issues = useMemo(() => blueprint ? validateResearchBlueprint(blueprint) : [], [blueprint]);
  const update = (field: keyof ResearchBlueprint, value: unknown) => {
    setBlueprint(current => current ? updateResearchBlueprint(current, { [field]: value } as Partial<ResearchBlueprint>) : current);
    setNotice("");
  };

  async function persist(next: ResearchBlueprint) {
    if (!project) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await updateLocalProject({
        ...project,
        name: next.title.trim() || project.name,
        researchQuestion: next.researchQuestion,
        objectives: next.objectives,
        methodology: next.methodology,
        paperType: next.paperType,
        intendedAudience: next.intendedAudience,
        availableMaterials: next.availableMaterials,
        updatedAt: Date.now()
      });
      if (!saved) throw new Error("The project could not be updated.");
      const currentBlueprint = await loadResearchBlueprint(project.id);
      if (!currentBlueprint) throw new Error("The canonical research blueprint could not be loaded.");
      const savedBlueprint = await saveResearchBlueprint({
        ...next,
        id: project.id,
        projectId: project.id,
        title: saved.name,
        version: currentBlueprint.version,
        updatedAt: Date.now()
      }, currentBlueprint.version);
      if (!savedBlueprint) throw new Error("The blueprint could not be saved.");
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      setBlueprint(savedBlueprint);
      setNotice("Blueprint saved to this device.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The blueprint could not be saved.");
    } finally { setSaving(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blueprint) await persist({ ...blueprint, updatedAt: Date.now() });
  }

  async function approve() {
    if (!blueprint) return;
    try {
      const approved = approveResearchBlueprint(blueprint, { now: Date.now(), approvedBy: "local-researcher" });
      await persist(approved);
      setNotice("Blueprint approved by the researcher. You can now use it as the production plan baseline.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The blueprint could not be approved.");
    }
  }

  if (loading) return <div className="state-panel" role="status">Opening your local research projects…</div>;
  if (error && !projects.length) return <div className="state-panel state-error" role="alert">{error}</div>;
  if (!projects.length) return <Card className="plan-empty"><ClipboardList size={24}/><h2>Create a project to begin</h2><p>Research Blueprint is linked to an existing local project. Create one in Projects, then return here.</p></Card>;

  return (
    <section className="plan-workspace" aria-label="Research blueprint workspace">
      <div className="plan-toolbar">
        <div><p className="eyebrow">DESIGN THE STUDY</p><h2>Build a defensible research plan.</h2><p>Capture the question, methods, evidence strategy and analysis plan before work begins.</p></div>
        <label className="plan-project-select"><span>Project</span><select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label>
      </div>
      {blueprint && <form className="blueprint-form" onSubmit={save}>
        <Card className="plan-section">
          <div className="plan-section-heading"><div><span className="plan-step">01</span><div><h3>Research identity</h3><p>Define what you are investigating and who the work is for.</p></div></div><span className={blueprint.approvalStatus === "approved" ? "plan-state approved" : "plan-state"}>{blueprint.approvalStatus === "approved" ? "Researcher approved" : "Draft"}</span></div>
          <div className="plan-fields">
            <label className="plan-field"><span>Research title</span><input value={blueprint.title} maxLength={180} onChange={event => update("title", event.target.value)} required /></label>
            <label className="plan-field"><span>Research type</span><select value={blueprint.paperType} onChange={event => update("paperType", event.target.value)}>{paperTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="plan-field full"><span>Primary research question</span><textarea rows={3} value={blueprint.researchQuestion} onChange={event => update("researchQuestion", event.target.value)} placeholder="What do you want to understand, explain, compare or evaluate?" /></label>
            <label className="plan-field"><span>Intended audience</span><input value={blueprint.intendedAudience} onChange={event => update("intendedAudience", event.target.value)} placeholder="Researchers, clinicians, policymakers…" /></label>
            <label className="plan-field"><span>Question framework</span><select value={blueprint.framework} onChange={event => update("framework", event.target.value)}><option value="PICO">PICO — Population, Intervention, Comparator, Outcome</option><option value="PECO">PECO — Population, Exposure, Comparator, Outcome</option><option value="PICOT">PICOT — PICO + Time</option><option value="SPIDER">SPIDER — Sample, Phenomenon, Design, Evaluation, Research type</option><option value="custom">Custom framework</option></select></label>
          </div>
          <div className="plan-fields">
            <label className="plan-field"><span>Population / sample</span><textarea rows={2} value={blueprint.population} onChange={event => update("population", event.target.value)} /></label>
            <label className="plan-field"><span>Intervention / exposure / phenomenon</span><textarea rows={2} value={blueprint.intervention} onChange={event => update("intervention", event.target.value)} /></label>
            <label className="plan-field"><span>Comparator</span><textarea rows={2} value={blueprint.comparator} onChange={event => update("comparator", event.target.value)} /></label>
            <label className="plan-field"><span>Outcomes / evaluation</span><textarea rows={2} value={blueprint.outcomes} onChange={event => update("outcomes", event.target.value)} /></label>
            <label className="plan-field"><span>Timeframe</span><input value={blueprint.timeframe} onChange={event => update("timeframe", event.target.value)} placeholder="Follow-up or study period" /></label>
          </div>
        </Card>

        <Card className="plan-section">
          <div className="plan-section-heading"><div><span className="plan-step">02</span><div><h3>Objectives and methodology</h3><p>Make the research aims and design explicit.</p></div></div></div>
          <div className="plan-fields">
            <label className="plan-field full"><span>Specific objectives <small>One objective per line</small></span><textarea rows={5} value={blueprint.objectives.join("\n")} onChange={event => update("objectives", event.target.value.split("\n").map(value => value.trim()).filter(Boolean))} placeholder={"Estimate…\nCompare…\nExplore…"} /></label>
            <label className="plan-field"><span>Methodology</span><textarea rows={4} value={blueprint.methodology} onChange={event => update("methodology", event.target.value)} placeholder="Quantitative, qualitative, mixed methods, review methodology…" /></label>
            <label className="plan-field"><span>Study design and setting</span><textarea rows={4} value={blueprint.studyDesign} onChange={event => update("studyDesign", event.target.value)} placeholder="Design, location, facilities, recruitment and sampling…" /></label>
            <label className="plan-field full"><span>Inclusion criteria</span><textarea rows={3} value={blueprint.inclusionCriteria} onChange={event => update("inclusionCriteria", event.target.value)} /></label>
            <label className="plan-field full"><span>Exclusion criteria</span><textarea rows={3} value={blueprint.exclusionCriteria} onChange={event => update("exclusionCriteria", event.target.value)} /></label>
          </div>
        </Card>

        <Card className="plan-section">
          <div className="plan-section-heading"><div><span className="plan-step">03</span><div><h3>Evidence, analysis and feasibility</h3><p>Plan how the work will be supported and evaluated.</p></div></div></div>
          <div className="plan-fields">
            <label className="plan-field full"><span>Search sources and databases <small>One source per line</small></span><textarea rows={3} value={blueprint.searchSources.join("\n")} onChange={event => update("searchSources", event.target.value.split("\n").map(value => value.trim()).filter(Boolean))} placeholder={"PubMed / MEDLINE\nEmbase\nCochrane Library"} /></label>
            <label className="plan-field full"><span>Analysis plan</span><textarea rows={4} value={blueprint.analysisPlan} onChange={event => update("analysisPlan", event.target.value)} placeholder="Describe planned statistical, qualitative or synthesis methods and assumptions." /></label>
            <label className="plan-field"><span>Ethics and governance</span><textarea rows={3} value={blueprint.ethicsConsiderations} onChange={event => update("ethicsConsiderations", event.target.value)} /></label>
            <label className="plan-field"><span>Feasibility and resources</span><textarea rows={3} value={blueprint.feasibilityNotes} onChange={event => update("feasibilityNotes", event.target.value)} /></label>
            <label className="plan-field full"><span>Available materials and resources <small>One item per line</small></span><textarea rows={3} value={blueprint.availableMaterials.join("\n")} onChange={event => update("availableMaterials", event.target.value.split("\n").map(value => value.trim()).filter(Boolean))} /></label>
          </div>
        </Card>

        <div className="blueprint-validation" aria-live="polite">
          <div><ShieldCheck size={17}/><strong>{issues.length ? `${issues.length} items required before approval` : "Required blueprint sections are complete"}</strong></div>
          {issues.length > 0 && <ul>{issues.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul>}
        </div>
        {error && <p className="plan-message error" role="alert">{error}</p>}
        {notice && <p className="plan-message success" role="status">{notice}</p>}
        <div className="plan-actions">
          <span>{blueprint.approvalStatus === "approved" ? "Approved plans remain editable; changes require a new researcher approval." : "Drafts are saved locally and are not shared automatically."}</span>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Save size={15}/> Save blueprint</>}</Button>
          <Button type="button" variant="secondary" disabled={saving || issues.length > 0 || blueprint.approvalStatus === "approved"} onClick={approve}><CheckCircle2 size={15}/> Approve blueprint</Button>
        </div>
      </form>}
    </section>
  );
}
