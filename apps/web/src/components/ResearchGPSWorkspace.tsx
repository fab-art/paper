import { useEffect, useMemo, useState } from "react";
import { Compass, FolderOpen, Save, Sparkles } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Project } from "../../../../frontend/src/lib/types";
import {
  buildResearchIntake, createResearchStationPlan, getResearchEntryPlan, getResearchNextAction,
  PAPER_TYPE_BLUEPRINTS, RESEARCH_ENTRY_PATHS,
  type ResearchEntryPath, type ResearchStationPlan
} from "../../../../frontend/src/lib/research-intake";
import ResearchPlanEditor from "../../../../frontend/src/components/ResearchPlanEditor";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";

export default function ResearchGPSWorkspace({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [problem, setProblem] = useState("");
  const [question, setQuestion] = useState("");
  const [audience, setAudience] = useState("");
  const [materialsText, setMaterialsText] = useState("");
  const [startPath, setStartPath] = useState<ResearchEntryPath>("idea");
  const [paperType, setPaperType] = useState<Project["paperType"]>("empirical-study");
  const [plan, setPlan] = useState<ResearchStationPlan>(() => createResearchStationPlan("empirical-study", "idea"));
  const [storyArc, setStoryArc] = useState<string[]>([]);
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
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The local project library could not be opened.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const project = useMemo(() => projects.find(item => item.id === projectId) ?? null, [projects, projectId]);

  useEffect(() => {
    if (!project) return;
    const nextPath = project.startPath ?? "idea";
    const nextType = project.paperType ?? "empirical-study";
    setProblem(project.researchProblem ?? "");
    setQuestion(project.researchQuestion ?? "");
    setAudience(project.intendedAudience ?? "");
    setMaterialsText((project.availableMaterials ?? []).join("\n"));
    setStartPath(nextPath);
    setPaperType(nextType);
    setPlan(project.researchPlan ?? createResearchStationPlan(nextType, nextPath));
    const intake = buildResearchIntake({
      title: project.name,
      problemOrObservation: project.researchProblem ?? "",
      researchQuestion: project.researchQuestion ?? "",
      intendedAudience: project.intendedAudience ?? "",
      availableMaterials: project.availableMaterials ?? [],
      paperType: nextType,
      startPath: nextPath
    });
    setStoryArc(project.storyArc?.length ? project.storyArc : intake.storyArc);
    setError("");
    setNotice("");
  }, [projectId, project?.updatedAt]);

  const route = useMemo(() => getResearchEntryPlan(startPath, paperType), [startPath, paperType]);
  const nextAction = useMemo(() => project ? getResearchNextAction({
    ...project, researchQuestion: question, paperType, startPath
  }, plan) : null, [project, question, paperType, startPath, plan]);

  function changeEntryPath(value: ResearchEntryPath) {
    setStartPath(value);
    setPlan(createResearchStationPlan(paperType ?? "empirical-study", value));
    setNotice("The suggested station sequence has been updated. Review it before saving.");
  }

  function changePaperType(value: NonNullable<Project["paperType"]>) {
    setPaperType(value);
    setPlan(createResearchStationPlan(value, startPath));
    setNotice("The suggested plan has been regenerated for the selected research output. Review custom tasks before saving.");
  }

  function updatePlan(next: ResearchStationPlan) {
    setPlan(next);
  }

  async function save() {
    if (!project) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const intake = buildResearchIntake({
        title: project.name,
        problemOrObservation: problem,
        researchQuestion: question,
        intendedAudience: audience,
        availableMaterials: materialsText.split("\n"),
        paperType: paperType ?? "empirical-study",
        startPath
      });
      const updated = await updateLocalProject({
        ...project,
        researchProblem: intake.description,
        researchQuestion: intake.researchQuestion,
        intendedAudience: intake.intendedAudience,
        availableMaterials: intake.availableMaterials,
        paperType: intake.paperType,
        startPath,
        researchMode: "guided",
        researchPlan: { ...plan, paperType: intake.paperType, entryPath: startPath, updatedAt: Date.now() },
        storyArc: storyArc.length ? storyArc : intake.storyArc,
        updatedAt: Date.now()
      });
      if (!updated) throw new Error("The research GPS plan could not be saved.");
      setProjects(current => current.map(item => item.id === updated.id ? updated : item));
      setNotice("Research GPS and its station plan were saved to this device.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The research GPS plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="state-panel" role="status">Opening your local research projects…</div>;
  if (error && !projects.length) return <div className="state-panel state-error" role="alert">{error}</div>;
  if (!projects.length) return (
    <Card className="plan-empty">
      <Compass size={24}/>
      <h2>Start with a research project</h2>
      <p>Research GPS turns your idea, literature question, dataset or manuscript into a guided research route. Create a local project first.</p>
      <Button onClick={() => onNavigate("/projects")}><FolderOpen size={15}/> Open Projects</Button>
    </Card>
  );

  return (
    <section className="plan-workspace research-gps-workspace" aria-label="Research GPS guided intake and planning">
      <div className="plan-toolbar">
        <div><p className="eyebrow">RESEARCH GPS · GUIDED START</p><h2>Choose your starting point. Build a route you can own.</h2><p>Research GPS helps structure the next steps; it does not decide the scientific question or approve the methods for you.</p></div>
        <label className="plan-project-select"><span>Project</span><select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label>
      </div>
      {project && <div className="blueprint-form">
        <Card className="plan-section">
          <div className="plan-section-heading"><div><span className="plan-step">01</span><div><h3>Where are you starting?</h3><p>Select the route that best matches the work you already have.</p></div></div></div>
          <div className="plan-fields">
            <label className="plan-field"><span>Starting point</span><select value={startPath} onChange={event => changeEntryPath(event.target.value as ResearchEntryPath)}>{RESEARCH_ENTRY_PATHS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="plan-field"><span>Research output</span><select value={paperType ?? "empirical-study"} onChange={event => changePaperType(event.target.value as NonNullable<Project["paperType"]>)}>{PAPER_TYPE_BLUEPRINTS.filter(item => item.id !== "unspecified").map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <div className="plan-field full"><span>Recommended first action</span><p>{route.firstAction}</p><small>{route.description}</small></div>
          </div>
        </Card>
        <Card className="plan-section">
          <div className="plan-section-heading"><div><span className="plan-step">02</span><div><h3>Research intake</h3><p>Capture the context and intended contribution. You can refine these later.</p></div></div></div>
          <div className="plan-fields">
            <label className="plan-field full"><span>Problem or observation</span><textarea rows={3} value={problem} onChange={event => setProblem(event.target.value)} placeholder="What problem, gap or observation motivated this work?" /></label>
            <label className="plan-field full"><span>Research question</span><textarea rows={3} value={question} onChange={event => setQuestion(event.target.value)} placeholder="What do you want to understand, explain, compare or evaluate?" /></label>
            <label className="plan-field"><span>Intended audience</span><input value={audience} onChange={event => setAudience(event.target.value)} placeholder="Researchers, clinicians, policymakers…" /></label>
            <label className="plan-field"><span>Available materials</span><textarea rows={3} value={materialsText} onChange={event => setMaterialsText(event.target.value)} placeholder={"Dataset\nExisting manuscript\nStudy protocol"} /></label>
          </div>
        </Card>
        <Card className="plan-section research-gps-route">
          <div className="plan-section-heading"><div><span className="plan-step">03</span><div><h3>Your research route</h3><p>Suggested stages are editable and remain under your control.</p></div></div><Sparkles size={18}/></div>
          <ol>{route.route.map((station, index) => <li key={station}><span>{String(index + 1).padStart(2, "0")}</span>{station}</li>)}</ol>
          {nextAction && <div className="research-gps-next"><strong>Suggested next action · {nextAction.title}</strong><p>{nextAction.description}</p></div>}
        </Card>
        <Card className="plan-section">
          <div className="plan-section-heading"><div><span className="plan-step">04</span><div><h3>Editable research plan</h3><p>Add tasks and milestones, and rearrange the station sequence as your project develops.</p></div></div></div>
          <ResearchPlanEditor plan={plan} onChange={updatePlan} storyArc={storyArc} onStoryArcChange={setStoryArc}/>
        </Card>
        {error && <p className="plan-message error" role="alert">{error}</p>}
        {notice && <p className="plan-message success" role="status">{notice}</p>}
        <div className="plan-actions"><span>Saved locally only. No project is uploaded or shared automatically.</span><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : <><Save size={15}/> Save Research GPS</>}</Button></div>
      </div>}
    </section>
  );
}
