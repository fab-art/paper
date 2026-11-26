import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, Cpu, FileCheck2, LoaderCircle, Play, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Project } from "../../../../frontend/src/lib/types";
import type { ProductionLine, ProductionTask, ResearchAgentProposal } from "../../../../frontend/src/lib/research-blueprint";
import { complete, loadLocalModel, MODEL_OPTIONS } from "../../../../frontend/src/lib/llm";
import { listLocalProjects, updateLocalProject, loadResearchBlueprint } from "../adapters/legacy-projects";
import {
  applyApprovedResearchProposal, buildResearchAgentPrompt, createResearchAgentProposal,
  createResearchTaskBrief, decideResearchAgentProposal
} from "../domain/intelligent-orchestration.mjs";
import { createProductionPlan, getTaskReadiness } from "../domain/research-orchestration.mjs";
import "./intelligent-orchestration.css";

function parseModelJson(value: string) {
  const cleaned = value.trim().replace(/^\u0060\u0060\u0060(?:json)?\s*/i, "").replace(/\s*\u0060\u0060\u0060$/, "");
  return JSON.parse(cleaned);
}

export default function IntelligentOrchestrationWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [plan, setPlan] = useState<ProductionLine | null>(null);
  const [blueprint, setBlueprint] = useState<ResearchBlueprint | null>(null);
  const [taskId, setTaskId] = useState("");
  const [proposal, setProposal] = useState<ResearchAgentProposal | null>(null);
  const [modelId, setModelId] = useState<string>(MODEL_OPTIONS[0].id);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState({ text: "Model not loaded", progress: 0 });
  const [generating, setGenerating] = useState(false);
  const [rawOutput, setRawOutput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listLocalProjects().then(rows => {
      if (!active) return;
      const available = rows.filter(project => !project.archivedAt);
      setProjects(available);
      setProjectId(available[0]?.id ?? "");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The local research library could not be opened.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const project = useMemo(() => projects.find(item => item.id === projectId) ?? null, [projects, projectId]);

  useEffect(() => {
    let active = true;
    setPlan(project ? createProductionPlan(project) : null);
    setTaskId("");
    setProposal(null);
    setRawOutput("");
    setError("");
    setNotice("");
    setBlueprint(null);
    if (!project) return () => { active = false; };
    loadResearchBlueprint(project.id).then(value => {
      if (active) setBlueprint(value ?? null);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The approved research blueprint could not be checked.");
    });
    return () => { active = false; };
  }, [projectId]);

  const availableTasks = useMemo(() => plan?.tasks.filter(task => task.status === "in-progress") ?? [], [plan]);
  const task = useMemo(() => plan?.tasks.find(item => item.id === taskId) ?? null, [plan, taskId]);
  const readiness = useMemo(() => {
    if (!plan || !task) return null;
    try { return getTaskReadiness(plan, task.id, { blueprintApproved: blueprint?.approvalStatus === "approved" }); }
    catch { return { ready: false, blockedBy: ["task-not-found"] }; }
  }, [plan, task, blueprint]);

  useEffect(() => {
    const latest = task?.orchestrationProposals?.at(-1) ?? null;
    setProposal(latest);
    setRawOutput("");
  }, [taskId, task?.updatedAt]);

  async function persistPlan(nextPlan: ProductionLine) {
    if (!project) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await updateLocalProject({ ...project, productionLine: nextPlan, updatedAt: Date.now() });
      if (!saved) throw new Error("The local project changed or could not be saved. Reload the project and try again.");
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      setPlan(nextPlan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The orchestration record could not be saved.");
      throw reason;
    } finally {
      setSaving(false);
    }
  }

  function makeBrief() {
    if (!project || !plan || !task) throw new Error("Select a started production task first.");
    const contextSources = (project.papers ?? []).map((paper, index) => ({
      id: `paper:${paper.doi || paper.url || index}`,
      kind: "paper",
      label: paper.title || `Imported paper ${index + 1}`,
      sourceLocator: paper.doi || paper.url || null,
      excerpt: paper.abstract ?? "",
      version: 1
    }));
    return createResearchTaskBrief({ project, task, plan, blueprint, contextSources });
  }

  async function loadModel() {
    setModelLoading(true);
    setError("");
    try {
      await loadLocalModel(modelId, (text, progress) => setModelProgress({ text, progress }));
      setModelReady(true);
      setModelProgress({ text: "Local model ready", progress: 1 });
      setNotice("The selected model is running in your browser. Project content stays on this device.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local model could not be loaded.");
    } finally {
      setModelLoading(false);
    }
  }

  async function generateProposal() {
    if (!task || !plan || !project || !readiness?.ready) return;
    setGenerating(true);
    setError("");
    setNotice("");
    setRawOutput("");
    try {
      if (!modelReady) throw new Error("Load a local model before generating a proposal.");
      const brief = makeBrief();
      const prompt = buildResearchAgentPrompt(brief);
      const raw = await complete(`SYSTEM INSTRUCTIONS\n${prompt.system}\n\nTASK DATA\n${prompt.user}`, token => {
        setRawOutput(current => current + token);
      });
      setRawOutput(raw);
      const output = parseModelJson(raw);
      const created = createResearchAgentProposal({ brief, output });
      const updatedTask = { ...task, orchestrationProposals: [...(task.orchestrationProposals ?? []), created] };
      const nextPlan = { ...plan, version: plan.version + 1, tasks: plan.tasks.map(item => item.id === task.id ? updatedTask : item), updatedAt: Date.now() };
      await persistPlan(nextPlan);
      setProposal(created);
      setNotice("AI proposal saved locally. Review its evidence references and limitations before approval.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The AI proposal could not be generated or validated.");
    } finally {
      setGenerating(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!task || !plan || !proposal) return;
    try {
      const nextProposal = decideResearchAgentProposal(proposal, decision, { actor: "local-researcher" });
      const updatedTask = { ...task, orchestrationProposals: (task.orchestrationProposals ?? []).map(item => item.id === proposal.id ? nextProposal : item) };
      const nextPlan = { ...plan, version: plan.version + 1, tasks: plan.tasks.map(item => item.id === task.id ? updatedTask : item), updatedAt: Date.now() };
      await persistPlan(nextPlan);
      setProposal(nextProposal);
      setNotice(decision === "approve" ? "Proposal approved by the researcher. You may now apply its draft deliverables." : "Proposal rejected and retained in the audit trail.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The proposal decision could not be saved.");
    }
  }

  async function applyProposal() {
    if (!task || !plan || !proposal) return;
    try {
      const result = applyApprovedResearchProposal(task, proposal, { expectedTaskVersion: proposal.taskVersion, actor: "local-researcher" });
      const updatedTask = {
        ...result.task,
        orchestrationProposals: (task.orchestrationProposals ?? []).map(item => item.id === proposal.id ? result.proposal : item)
      };
      const nextPlan = { ...plan, version: plan.version + 1, tasks: plan.tasks.map(item => item.id === task.id ? updatedTask : item), updatedAt: Date.now() };
      await persistPlan(nextPlan);
      setProposal(result.proposal);
      setNotice("Approved deliverables were attached to this task. The task remains in progress until you confirm completion in Production Line.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The approved proposal could not be applied.");
    }
  }

  async function copyPrompt() {
    try {
      const prompt = buildResearchAgentPrompt(makeBrief());
      await navigator.clipboard.writeText(`SYSTEM INSTRUCTIONS\n${prompt.system}\n\nTASK DATA\n${prompt.user}`);
      setNotice("Task prompt copied.");
    } catch {
      setError("The task prompt could not be copied in this browser.");
    }
  }

  if (loading) return <div className="state-panel" role="status">Opening your local research projects…</div>;
  if (!projects.length) return <Card className="plan-empty"><Sparkles size={24}/><h2>Create a project to begin</h2><p>Intelligent Orchestration works with existing local projects and their Production Line.</p></Card>;

  return (
    <section className="plan-workspace orchestration-workspace" aria-label="Intelligent research orchestration">
      <div className="plan-toolbar">
        <div><p className="eyebrow">LOCAL AI · RESEARCHER CONTROLLED</p><h2>Turn active tasks into reviewed research work.</h2><p>Prepare a bounded task brief, run the local model, validate its proposal and approve deliverables before they are attached to your project.</p></div>
        <label className="plan-project-select"><span>Project</span><select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label>
      </div>

      <Card className="orchestration-model">
        <div className="orchestration-model-copy"><div className="orchestration-model-icon"><Cpu size={18}/></div><div><strong>Browser-local research assistant</strong><p>{modelProgress.text}{modelReady ? " · Project data remains in this browser." : " · The model is downloaded and run on this device."}</p></div></div>
        <div className="orchestration-model-controls">
          <label><span>Model</span><select value={modelId} disabled={modelReady || modelLoading} onChange={event => setModelId(event.target.value)}>{MODEL_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <Button size="sm" onClick={() => void loadModel()} disabled={modelReady || modelLoading}>{modelLoading ? <><LoaderCircle size={14} className="spin"/> Loading {Math.round(modelProgress.progress * 100)}%</> : modelReady ? <><Check size={14}/> Model ready</> : <><Cpu size={14}/> Load local model</>}</Button>
        </div>
      </Card>

      <Card className="orchestration-task-card">
        <div className="orchestration-section-heading"><div><p className="eyebrow">PRODUCTION LINE HANDOFF</p><h3>Select an active task</h3></div><span>{availableTasks.length} in progress</span></div>
        {availableTasks.length ? <label className="plan-field"><span>Task to orchestrate</span><select value={taskId} onChange={event => setTaskId(event.target.value)}><option value="">Choose an active task</option>{availableTasks.map(item => <option key={item.id} value={item.id}>{item.title} · {item.stage}</option>)}</select></label> : <p className="orchestration-empty">No active tasks yet. Open Production Line, start a dependency-ready task, then return here.</p>}
        {task && readiness && <div className="orchestration-task-summary"><div><strong>{task.title}</strong><p>{task.description || "No task description."}</p><span className={readiness.ready ? "orchestration-ready" : "orchestration-blocked"}>{readiness.ready ? "Ready for AI assistance" : `Blocked: ${readiness.blockedBy.join(", ")}`}</span></div><Button size="sm" variant="secondary" onClick={() => void copyPrompt()} disabled={!readiness.ready}><ClipboardCopy size={14}/> Copy task prompt</Button></div>}
        {!blueprint && task?.stage !== "blueprint" && <p className="orchestration-warning">The research blueprint has not been approved. Downstream AI assistance is blocked.</p>}
      </Card>

      {task && <Card className="orchestration-run-card">
        <div className="orchestration-section-heading"><div><p className="eyebrow">AI TASK PREPARATION</p><h3>Generate a research proposal</h3></div><Sparkles size={18}/></div>
        <p className="orchestration-helper">The prompt includes the approved research question and metadata/abstracts from papers already saved in this project. The model cannot change project decisions or mark the task complete.</p>
        <Button onClick={() => void generateProposal()} disabled={!modelReady || !readiness?.ready || generating || saving}>{generating ? <><LoaderCircle size={14} className="spin"/> Generating proposal…</> : <><Play size={14}/> Generate with local model</>}</Button>
        {rawOutput && !proposal && <pre className="orchestration-raw-output" aria-label="Raw model response">{rawOutput}</pre>}
      </Card>}

      {proposal && <Card className="orchestration-proposal-card">
        <div className="orchestration-section-heading"><div><p className="eyebrow">RESEARCHER REVIEW</p><h3>{proposal.summary}</h3></div><span className={`orchestration-status status-${proposal.status}`}>{proposal.status}</span></div>
        <ol className="orchestration-steps">{proposal.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
        <div className="orchestration-deliverables"><strong>Proposed deliverables</strong>{proposal.deliverables.map((item, index) => <article key={index}><h4>{item.title}</h4><p>{item.content}</p>{item.evidenceRefs.length > 0 && <small>Evidence references: {item.evidenceRefs.join(", ")}</small>}</article>)}</div>
        {proposal.limitations.length > 0 && <div className="orchestration-limitations"><strong>Limitations to review</strong><ul>{proposal.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        <div className="orchestration-audit"><strong>Decision history</strong>{proposal.auditTrail.map((event, index) => <p key={index}><span>{event.event}</span> · {event.actor} · {new Date(event.at).toLocaleString()}</p>)}</div>
        {proposal.status === "proposed" && <div className="orchestration-actions"><span>Approval is explicit. Review all claims and sources before accepting.</span><Button variant="secondary" onClick={() => void decide("reject")} disabled={saving}><X size={14}/> Reject</Button><Button onClick={() => void decide("approve")} disabled={saving}><ShieldCheck size={14}/> Approve proposal</Button></div>}
        {proposal.status === "approved" && <div className="orchestration-actions"><span>Approval does not mark the task complete.</span><Button onClick={() => void applyProposal()} disabled={saving}><FileCheck2 size={14}/> Apply approved deliverables</Button></div>}
        {proposal.status === "applied" && <p className="orchestration-applied"><Check size={15}/> Applied to the task. Confirm completion separately in Production Line.</p>}
      </Card>}

      {error && <p className="plan-message error" role="alert">{error}</p>}
      {notice && <p className="plan-message success" role="status">{notice}</p>}
      <p className="production-footnote">Local-first by default. AI output is untrusted until reviewed. No automatic upload, scientific approval, publication submission or task completion occurs in this workspace.</p>
    </section>
  );
}
