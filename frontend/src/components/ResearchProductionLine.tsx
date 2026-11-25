import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Progress } from "@santi020k/lumen-react";
import {
  ArrowRight, Bot, CheckCircle2, Circle, Clock3, Pause, Play, Plus,
  RefreshCw, ShieldCheck, Sparkles, Workflow, XCircle
} from "lucide-react";
import type { ResearchPaperType } from "../lib/research-blueprint";
import {
  getResearchRoute, getReadyResearchTasks, RESEARCH_AGENTS, summarizeResearchStations,
  type ResearchStationId, type ResearchTask, type ResearchAuditEvent
} from "../lib/research-production-line";
import {
  createResearchTaskRecord, getResearchControl, listResearchAuditEvents, listResearchTasks,
  setResearchAgentsPaused, transitionResearchTaskRecord
} from "../lib/db";
import "./research-production-line.css";
import { isResearchAgentRunnerReady, runResearchSpecialistTask } from "../lib/research-agent-executor";

const statusLabel: Record<string, string> = {
  "not-started": "Not started", queued: "In queue", running: "In progress",
  "owner-review": "Owner review", complete: "Complete", attention: "Needs attention"
};
const taskStatusLabel: Record<string, string> = {
  queued: "Queued", running: "In progress", "awaiting-owner": "Awaiting your decision",
  completed: "Completed", failed: "Failed", blocked: "Blocked", stale: "Needs re-check", canceled: "Canceled"
};
const uid = () => Math.random().toString(36).slice(2, 12);

export default function ResearchProductionLine({
  projectId, paperType, researchMode, onModeChange, onOpenStudio
}: {
  projectId: string;
  paperType: ResearchPaperType;
  researchMode: "guided" | "professional";
  onModeChange: (mode: "guided" | "professional") => void;
  onOpenStudio?: () => void;
}) {
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [events, setEvents] = useState<ResearchAuditEvent[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [inputEntityIdsText, setInputEntityIdsText] = useState("");
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const localModelReady = isResearchAgentRunnerReady();
  const [showComposer, setShowComposer] = useState(false);
  const [stationId, setStationId] = useState<ResearchStationId>("intake");
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerGate, setOwnerGate] = useState(false);
  const [beforeRun, setBeforeRun] = useState(false);

  const route = useMemo(() => getResearchRoute(paperType), [paperType]);
  const summaries = useMemo(() => summarizeResearchStations(tasks, paperType), [tasks, paperType]);
  const completedTasks = tasks.filter(task => task.status === "completed").length;
  const overall = tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0;
  const agentReadyCount = getReadyResearchTasks(tasks, paused).filter(task => Boolean(task.assignedAgentId)).length;
  const nextStation = summaries.find(item => item.status !== "complete") ?? summaries[0];

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextTasks, control, nextEvents] = await Promise.all([
        listResearchTasks(projectId), getResearchControl(projectId), listResearchAuditEvents(projectId)
      ]);
      setTasks(nextTasks);
      setEvents(nextEvents.slice(0, 12));
      setPaused(control.agentsPaused);
      setError("");
    } catch (cause) {
      setError((cause as Error).message || "Could not load the production line.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, [projectId]);

  const changeTask = async (task: ResearchTask, action: "start" | "submit" | "approve" | "request-changes" | "retry" | "cancel") => {
    try {
      const rationale = action === "approve" || action === "request-changes"
        ? (window.prompt(action === "approve" ? "Optional approval rationale:" : "What should be changed before resubmission?") ?? "")
        : "";
      if ((action === "approve" || action === "request-changes") && !window.confirm(action === "approve" ? "Approve this task output as the project owner?" : "Return this task for changes?")) return;
      if (action === "cancel" && !window.confirm("Cancel this task? Its history will be retained.")) return;
      let outputEntityIds: string[] = [];
      if (action === "submit" && researchMode === "professional") {
        const raw = window.prompt("Enter existing research entity IDs produced by this task, separated by commas. Leave blank if there are no linked outputs yet.");
        if (raw === null) return;
        outputEntityIds = raw.split(",").map(value => value.trim()).filter(Boolean);
      }
      await transitionResearchTaskRecord(projectId, task.id, action, "owner", action === "approve" || action === "request-changes", rationale, task.version, undefined, outputEntityIds);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message || "The task could not be updated.");
    }
  };

  const runSpecialist = async (task: ResearchTask) => {
    if (!task.assignedAgentId) return;
    setRunningTaskId(task.id);
    setError("");
    try {
      await runResearchSpecialistTask(projectId, task.id, task.assignedAgentId);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message || "The specialist could not complete this task.");
      await refresh();
    } finally {
      setRunningTaskId(null);
    }
  };

  const togglePause = async () => {
    const next = !paused;
    if (!window.confirm(next ? "Pause all specialist-agent work in this project?" : "Resume specialist-agent work in this project?")) return;
    try {
      await setResearchAgentsPaused(projectId, next, true);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message || "The agent control could not be updated.");
    }
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await createResearchTaskRecord({
        projectId, stationId, title, description, assignedAgentId: agentId || undefined,
        dependencyTaskIds: dependencies,
        inputEntityIds: inputEntityIdsText.split(",").map(value => value.trim()).filter(Boolean),
        ownerApprovalRequired: ownerGate, ownerApprovalBeforeRun: beforeRun
      });
      setTitle(""); setDescription(""); setAgentId(""); setDependencies([]); setInputEntityIdsText(""); setOwnerGate(false); setBeforeRun(false); setShowComposer(false);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message || "The task could not be added.");
    }
  };

  if (loading) return <div className="rpl-loading" role="status">Preparing your research production line…</div>;

  return <div className="rpl-root">
    <header className="rpl-header">
      <div>
        <div className="rpl-eyebrow"><Workflow size={14}/> RESEARCH PRODUCTION LINE</div>
        <h2>Build the research, one station at a time.</h2>
        <p>Each station prepares a traceable part of the final research output. You remain the project owner and final decision-maker.</p>
      </div>
      <div className="rpl-header-actions">
        <div className="rpl-mode-switch" role="group" aria-label="Research workspace mode">
          <button type="button" aria-pressed={researchMode === "guided"} onClick={() => onModeChange("guided")}>Guided</button>
          <button type="button" aria-pressed={researchMode === "professional"} onClick={() => onModeChange("professional")}>Professional</button>
        </div>
        <Button type="button" variant={paused ? "secondary" : "outline"} size="sm" onClick={() => void togglePause()}>
          {paused ? <Play size={14}/> : <Pause size={14}/>} {paused ? "Resume agents" : "Pause agents"}
        </Button>
      </div>
    </header>

    {error && <div className="rpl-error" role="alert"><XCircle size={15}/><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}

    <Card className="rpl-progress-card">
      <div className="rpl-progress-head">
        <div><span className="rpl-eyebrow">PROJECT ASSEMBLY</span><strong>{completedTasks} of {tasks.length} tasks completed</strong></div>
        <span className="rpl-progress-value">{overall}%</span>
      </div>
      <Progress value={overall} max={100} aria-label="Research task completion"/>
      <div className="rpl-progress-foot"><span>{route.length} stations in this suggested route · {agentReadyCount} agent-assigned tasks eligible for dispatch</span><span>{paused ? "Specialist agents paused by owner" : "Owner controls active"}</span></div>
    </Card>

    {researchMode === "guided" && nextStation && <Card className="rpl-next-card">
      <div className="rpl-next-icon"><Sparkles size={18}/></div>
      <div className="rpl-next-copy"><span className="rpl-eyebrow">YOUR NEXT RECOMMENDED STEP</span><h3>{nextStation.label}</h3><p>{nextStation.purpose}</p><small>Expected output: {nextStation.outputs.join(" · ")}</small></div>
      <Button type="button" size="sm" onClick={() => { setStationId(nextStation.id); setShowComposer(true); }}>Add a task <ArrowRight size={14}/></Button>
    </Card>}

    <div className="rpl-station-heading"><div><span className="rpl-eyebrow">THE RESEARCH LINE</span><h3>Stations</h3></div><Button type="button" variant="outline" size="sm" onClick={() => setShowComposer(value => !value)}><Plus size={14}/> Add task</Button></div>
    <div className="rpl-station-grid">
      {summaries.map((station, index) => (
        <Card key={station.id} className={`rpl-station-card status-${station.status}`}>
          <div className="rpl-station-top"><span className="rpl-station-number">{String(index + 1).padStart(2, "0")}</span><Badge variant={station.status === "complete" ? "success" : station.status === "attention" ? "warning" : "secondary"}>{statusLabel[station.status]}</Badge></div>
          <h4>{station.label}</h4><p>{station.purpose}</p>
          <div className="rpl-station-bottom"><span>{station.completed}/{station.taskCount} tasks done</span><button type="button" onClick={() => { setStationId(station.id); setShowComposer(true); }}>Add task</button></div>
          {researchMode === "professional" && <div className="rpl-station-outputs"><small>Outputs: {station.outputs.join(", ")}</small><small>Agents: {station.agentIds.join(", ")}</small></div>}
        </Card>
      ))}
    </div>

    {showComposer && <Card className="rpl-composer">
      <form onSubmit={createTask}>
        <div className="rpl-composer-head"><div><span className="rpl-eyebrow">NEW WORK ITEM</span><h3>Add a task to the line</h3></div><button type="button" aria-label="Close task form" onClick={() => setShowComposer(false)}>×</button></div>
        <label>Station<select value={stationId} onChange={event => setStationId(event.target.value as ResearchStationId)}>{route.map(station => <option key={station.id} value={station.id}>{station.label}</option>)}</select></label>
        <label>Task name<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Define the primary outcome measure"/></label>
        <label>What needs to be done?<textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the expected work or output."/></label>
        <label>Assign specialist (optional)<select value={agentId} onChange={event => setAgentId(event.target.value)}><option value="">Researcher / unassigned</option>{RESEARCH_AGENTS.filter(agent => agent.stationIds.includes(stationId)).map(agent => <option key={agent.id} value={agent.id}>{agent.label}</option>)}</select></label>
        {researchMode === "professional" && <label>Input entity IDs (optional, comma-separated)<input value={inputEntityIdsText} onChange={event => setInputEntityIdsText(event.target.value)} placeholder="e.g. source:123, dataset:456"/></label>}
        {tasks.length > 0 && <fieldset className="rpl-dependencies"><legend>Depends on (optional)</legend>{tasks.filter(task => task.status !== "canceled").map(task => <label key={task.id}><input type="checkbox" checked={dependencies.includes(task.id)} onChange={event => setDependencies(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))}/><span>{task.title} · {taskStatusLabel[task.status]}</span></label>)}</fieldset>}
        <div className="rpl-checks"><label><input type="checkbox" checked={ownerGate} onChange={event => setOwnerGate(event.target.checked)}/> Require my approval before this output is accepted</label><label><input type="checkbox" checked={beforeRun} onChange={event => setBeforeRun(event.target.checked)}/> Require my approval before work begins</label></div>
        {agentId && <div className="rpl-agent-note"><Bot size={14}/><div>Specialist output is always held for your review. {localModelReady ? "Your local model is ready to run this agent." : "Load a local WebLLM model in Writing Studio to execute this specialist."}{!localModelReady && onOpenStudio && <Button type="button" size="sm" variant="outline" onClick={onOpenStudio}>Open Writing Studio</Button>}</div></div>}
        <div className="rpl-composer-actions"><Button type="button" variant="ghost" size="sm" onClick={() => setShowComposer(false)}>Cancel</Button><Button type="submit" size="sm"><Plus size={14}/> Add to queue</Button></div>
      </form>
    </Card>}

    <section className="rpl-queue">
      <div className="rpl-station-heading"><div><span className="rpl-eyebrow">WORK QUEUE</span><h3>Tasks and owner decisions</h3></div><span className="rpl-queue-count">{tasks.length} total</span></div>
      {tasks.length === 0 ? <div className="rpl-empty"><Workflow size={24}/><strong>Your line is ready.</strong><p>Add a task to the first station. PaperOrchestra will keep its dependencies and approvals visible.</p><Button size="sm" onClick={() => { setStationId(route[0].id); setShowComposer(true); }}>Create first task</Button></div> :
        tasks.map(task => <Card key={task.id} className="rpl-task-card">
          <div className="rpl-task-icon">{task.status === "completed" ? <CheckCircle2 size={17}/> : task.status === "failed" || task.status === "blocked" ? <XCircle size={17}/> : task.status === "awaiting-owner" ? <ShieldCheck size={17}/> : task.status === "running" ? <Clock3 size={17}/> : <Circle size={17}/>}</div>
          <div className="rpl-task-main"><div className="rpl-task-title"><strong>{task.title}</strong><Badge variant={task.status === "completed" ? "success" : task.status === "awaiting-owner" ? "warning" : "secondary"}>{taskStatusLabel[task.status]}</Badge></div>
            <p>{task.description || route.find(station => station.id === task.stationId)?.label}</p>
            <small>{route.find(station => station.id === task.stationId)?.label} {task.assignedAgentId ? `· ${RESEARCH_AGENTS.find(agent => agent.id === task.assignedAgentId)?.label ?? "Specialist"}` : "· Researcher-owned"}</small>
            {researchMode === "professional" && <small>Task {task.id} · v{task.version} · {task.runCount} runs · {task.dependencyTaskIds.length} dependencies · {task.inputEntityIds.length} inputs · {task.outputEntityIds.length} outputs</small>}
          </div>
          <div className="rpl-task-actions">
            {task.status === "queued" && task.assignedAgentId && <Button size="sm" variant="outline" disabled={!localModelReady || paused || runningTaskId !== null || !task.dependencyTaskIds.every(id => tasks.find(dependency => dependency.id === id)?.status === "completed")} onClick={() => void runSpecialist(task)}>{runningTaskId === task.id ? "Running…" : paused ? "Agents paused" : !localModelReady ? "Load model first" : task.dependencyTaskIds.some(id => tasks.find(dependency => dependency.id === id)?.status !== "completed") ? "Waiting on dependency" : "Run specialist"}</Button>}
            {task.status === "queued" && !task.assignedAgentId && <Button size="sm" variant="outline" disabled={!task.dependencyTaskIds.every(id => tasks.find(dependency => dependency.id === id)?.status === "completed")} onClick={() => void changeTask(task, "start")}>{task.dependencyTaskIds.some(id => tasks.find(dependency => dependency.id === id)?.status !== "completed") ? "Waiting on dependency" : "Start work"}</Button>}
            {task.status === "running" && <Button size="sm" onClick={() => void changeTask(task, "submit")}>Submit output</Button>}
            {task.status === "awaiting-owner" && <><Button size="sm" onClick={() => void changeTask(task, "approve")}>Approve</Button><Button size="sm" variant="outline" onClick={() => void changeTask(task, "request-changes")}>Request changes</Button></>}
            {["failed", "blocked", "stale", "canceled"].includes(task.status) && <Button size="sm" variant="outline" onClick={() => void changeTask(task, "retry")}><RefreshCw size={13}/> Retry</Button>}
            {!["completed", "canceled"].includes(task.status) && <button type="button" className="rpl-cancel-task" onClick={() => void changeTask(task, "cancel")}>Cancel</button>}
          </div>
        </Card>)}
    </section>
    {researchMode === "professional" && <Card className="rpl-agent-roster">
      <div className="rpl-station-heading"><div><span className="rpl-eyebrow">AUDIT TRAIL</span><h3>Recent project activity</h3></div></div>
      {events.length ? <div className="rpl-audit-list">{events.map(event => <div key={event.id}><span>{new Date(event.createdAt).toLocaleString()}</span><strong>{event.event.replaceAll("-", " ")}</strong><p>{event.details}</p></div>)}</div> : <p className="rpl-agent-note">Task and owner-control events will be recorded here as work progresses.</p>}
    </Card>}
    {researchMode === "professional" && <Card className="rpl-agent-roster">
      <div className="rpl-station-heading"><div><span className="rpl-eyebrow">SPECIALIST NETWORK</span><h3>Agent responsibilities</h3></div><Badge variant="outline">{RESEARCH_AGENTS.length} roles</Badge></div>
      <div className="rpl-agent-grid">{RESEARCH_AGENTS.map(agent => <div key={agent.id}><strong>{agent.label}</strong><p>{agent.purpose}</p><small>Can propose: {agent.canPropose.join(", ")}</small><small>Cannot approve or make owner decisions</small></div>)}</div>
    </Card>}
    <p className="rpl-owner-note"><ShieldCheck size={15}/> You own the research. Specialist agents can prepare drafts and recommendations, but they cannot approve scientific decisions, change ethics declarations, determine authorship or submit your work. Pausing agents stops future dispatch; it does not interrupt a local model generation that is already running.</p>
  </div>;
}
