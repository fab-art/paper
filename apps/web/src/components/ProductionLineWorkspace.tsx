import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Circle, Clock3, Plus, Workflow } from "lucide-react";
import { Button, Card } from "@santi020k/lumen-react";
import type { Project } from "../../../../frontend/src/lib/types";
import type { ProductionLine, ProductionStage, ProductionTask } from "../../../../frontend/src/lib/research-blueprint";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";
import { addProductionTask, createProductionPlan, createProductionTask, getProductionProgress, getTaskReadiness, updateProductionTask } from "../domain/research-orchestration.mjs";

const stages: { value: ProductionStage; label: string }[] = [
  { value: "blueprint", label: "Plan" }, { value: "literature", label: "Literature" },
  { value: "evidence", label: "Evidence" }, { value: "analysis", label: "Analysis" },
  { value: "writing", label: "Writing" }, { value: "verification", label: "Verification" },
  { value: "publication", label: "Publication" }
];
const statusLabel = (status: ProductionTask["status"]) => status === "in-progress" ? "In progress" : status === "completed" ? "Completed" : status === "skipped" ? "Skipped" : "Planned";

export default function ProductionLineWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [plan, setPlan] = useState<ProductionLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskStage, setTaskStage] = useState<ProductionStage>("literature");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDependency, setTaskDependency] = useState("");

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
    setPlan(project ? createProductionPlan(project) : null);
    setError("");
    setNotice("");
  }, [projectId, project?.updatedAt]);

  const blueprintApproved = project?.researchBlueprint?.approvalStatus === "approved";
  const progress = useMemo(() => plan ? getProductionProgress(plan, { blueprintApproved }) : { total: 0, completed: 0, blocked: 0, remaining: 0, percent: 0 }, [plan, blueprintApproved]);

  async function persist(next: ProductionLine) {
    if (!project) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await updateLocalProject({ ...project, productionLine: next, updatedAt: Date.now() });
      if (!saved) throw new Error("The production plan could not be saved.");
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
      setPlan(next);
      setNotice("Production plan saved to this device.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The production plan could not be saved.");
    } finally { setSaving(false); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || !taskTitle.trim()) return;
    try {
      const task = createProductionTask({
        title: taskTitle, stage: taskStage, dueDate: taskDueDate,
        dependsOn: taskDependency ? [taskDependency] : [], now: Date.now()
      });
      await persist(addProductionTask(plan, task));
      setTaskTitle(""); setTaskDueDate(""); setTaskDependency("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The task could not be added.");
    }
  }

  async function changeStatus(task: ProductionTask, status: ProductionTask["status"]) {
    if (!plan) return;
    try {
      const patch = status === "completed" ? { status, completionConfirmedBy: "local-researcher" } : { status };
      await persist(updateProductionTask(plan, task.id, patch, { now: Date.now(), blueprintApproved: project?.researchBlueprint?.approvalStatus === "approved" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The task could not be updated.");
    }
  }

  if (loading) return <div className="state-panel" role="status">Opening your local research projects…</div>;
  if (error && !projects.length) return <div className="state-panel state-error" role="alert">{error}</div>;
  if (!projects.length) return <Card className="plan-empty"><Workflow size={24}/><h2>Create a project to begin</h2><p>Production Line is connected to your local project. Create one in Projects, then return here.</p></Card>;

  return (
    <section className="plan-workspace production-workspace" aria-label="Research production line">
      <div className="plan-toolbar">
        <div><p className="eyebrow">TURN THE PLAN INTO PROGRESS</p><h2>One connected research workflow.</h2><p>Track the work from protocol to publication. Tasks advance only when their dependencies are complete.</p></div>
        <label className="plan-project-select"><span>Project</span><select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label>
      </div>

      {plan && <>
        <Card className="production-overview">
          <div className="production-overview-top"><div><span className="eyebrow">PROJECT DELIVERY</span><h3>{project?.name}</h3><p>{project?.researchQuestion || "Add a research question in Research Blueprint to make the project objective explicit."}</p></div><div className="production-percent">{progress.percent}<small>%</small></div></div>
          <div className="production-progress-track" role="progressbar" aria-label="Research workflow completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ width: progress.percent + "%" }}/></div>
          <div className="production-metrics"><span><CheckCircle2 size={14}/>{progress.completed} completed</span><span><Clock3 size={14}/>{progress.remaining} remaining</span><span><Circle size={12}/>{progress.blocked} waiting on dependencies</span></div>
        </Card>

        <div className="production-section-heading"><div><p className="eyebrow">RESEARCH WORKFLOW</p><h3>Milestones and deliverables</h3></div><span>{progress.total} tasks</span></div>
        <div className="production-task-list">
          {plan.tasks.map((task, index) => {
            const readiness = getTaskReadiness(plan, task.id, { blueprintApproved });
            const dependencies = task.dependsOn.map(id => plan.tasks.find(item => item.id === id)?.title).filter(Boolean);
            return <Card className={"production-task " + (task.status === "completed" ? "is-complete" : "")} key={task.id}>
              <div className="production-task-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="production-task-main">
                <div className="production-task-top"><span className="production-stage">{stages.find(stage => stage.value === task.stage)?.label}</span><span className={"production-status status-" + task.status}>{statusLabel(task.status)}</span></div>
                <h4>{task.title}</h4><p>{task.description}</p>
                {dependencies.length > 0 && <div className={"production-dependency " + (readiness.ready ? "is-ready" : "")}><ArrowRight size={13}/>{readiness.ready ? "Dependencies complete" : readiness.blockedBy.includes("research-blueprint-approval") ? "Waiting for researcher approval of the blueprint" : "Waiting for: " + dependencies.join(", ")}</div>}
                {task.dueDate && <div className="production-due">Due {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(task.dueDate + "T00:00:00"))}</div>}
              </div>
              <div className="production-task-action">
                {task.status === "completed" ? <span className="task-done"><CheckCircle2 size={17}/> Done</span> :
                  task.status === "skipped" ? <span className="task-done">Skipped</span> :
                  task.status === "in-progress" ? <Button size="sm" onClick={() => void changeStatus(task, "completed")} disabled={saving || (task.stage === "blueprint" && project?.researchBlueprint?.approvalStatus !== "approved")}>{task.stage === "blueprint" && project?.researchBlueprint?.approvalStatus !== "approved" ? "Approve blueprint first" : "Confirm complete"}</Button> :
                  <Button size="sm" variant="secondary" onClick={() => void changeStatus(task, "in-progress")} disabled={saving || !readiness.ready}>{readiness.ready ? "Start task" : "Blocked"}</Button>}
              </div>
            </Card>;
          })}
        </div>

        <Card className="production-add">
          <div className="production-section-heading"><div><p className="eyebrow">CUSTOM WORK</p><h3>Add a task</h3></div></div>
          <form className="production-add-form" onSubmit={addTask}>
            <label className="plan-field"><span>Task name</span><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} required maxLength={180} placeholder="e.g. Submit ethics application"/></label>
            <label className="plan-field"><span>Research stage</span><select value={taskStage} onChange={event => setTaskStage(event.target.value as ProductionStage)}>{stages.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select></label>
            <label className="plan-field"><span>Depends on</span><select value={taskDependency} onChange={event => setTaskDependency(event.target.value)}><option value="">No dependency</option>{plan.tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
            <label className="plan-field"><span>Target date</span><input type="date" value={taskDueDate} onChange={event => setTaskDueDate(event.target.value)}/></label>
            <Button type="submit" disabled={saving || !taskTitle.trim()}><Plus size={15}/> Add task</Button>
          </form>
        </Card>
      </>}
      {error && <p className="plan-message error" role="alert">{error}</p>}
      {notice && <p className="plan-message success" role="status">{notice}</p>}
      <p className="production-footnote">AI assistance may prepare suggestions in later workflow steps. Task execution, completion and research judgments remain under researcher control. Local project data is not uploaded automatically.</p>
    </section>
  );
}
