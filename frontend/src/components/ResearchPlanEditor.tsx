import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@santi020k/lumen-react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  addResearchPlanMilestone, addResearchPlanTask, moveResearchPlanStation,
  removeResearchPlanTask, updateResearchPlanMilestone, updateResearchPlanTask,
  type ResearchPlanStationId, type ResearchStationPlan
} from "../lib/research-intake";
import "./research-plan-editor.css";

interface ResearchPlanEditorProps {
  plan: ResearchStationPlan;
  onChange: (plan: ResearchStationPlan) => void;
  storyArc: string[];
  onStoryArcChange: (storyArc: string[]) => void;
}

const PAPER_TYPE_LABELS: Record<string, string> = {
  "empirical-study": "Empirical study",
  "systematic-review": "Systematic review",
  "scoping-review": "Scoping review",
  "case-report": "Case report",
  "conference-paper": "Conference paper",
  "research-protocol": "Research protocol",
  "dataset-analysis": "Dataset analysis",
  "existing-manuscript": "Existing manuscript",
  other: "Custom research output",
  unspecified: "Flexible research plan"
};

export default function ResearchPlanEditor({ plan, onChange, storyArc, onStoryArcChange }: ResearchPlanEditorProps) {
  const [taskDrafts, setTaskDrafts] = useState<Record<string, { title: string; description: string }>>({});
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<string, { title: string; dueDate: string }>>({});
  const [storyDrafts, setStoryDrafts] = useState<string[]>(storyArc);
  const [newStoryBeat, setNewStoryBeat] = useState("");
  const [newTaskStation, setNewTaskStation] = useState<ResearchPlanStationId>(plan.stations[0]?.stationId ?? "intake");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setStoryDrafts(storyArc);
  }, [storyArc]);

  useEffect(() => {
    setTaskDrafts(Object.fromEntries(plan.stations.flatMap(station => station.tasks.map(task => [task.id, { title: task.title, description: task.description }]))));
    setMilestoneDrafts(Object.fromEntries(plan.milestones.map(milestone => [milestone.id, { title: milestone.title, dueDate: milestone.dueDate ?? "" }])));
    if (!plan.stations.some(station => station.stationId === newTaskStation)) setNewTaskStation(plan.stations[0]?.stationId ?? "intake");
  }, [plan]);

  const commitTask = (taskId: string) => {
    const draft = taskDrafts[taskId];
    if (!draft) return;
    try {
      onChange(updateResearchPlanTask(plan, taskId, draft));
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onChange(addResearchPlanTask(plan, newTaskStation, newTaskTitle, newTaskDescription));
      setNewTaskTitle("");
      setNewTaskDescription("");
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const addMilestone = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onChange(addResearchPlanMilestone(plan, newMilestoneTitle, newMilestoneDate || undefined));
      setNewMilestoneTitle("");
      setNewMilestoneDate("");
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const updateMilestone = (milestoneId: string, patch: { title?: string; dueDate?: string; completed?: boolean }) => {
    try {
      onChange(updateResearchPlanMilestone(plan, milestoneId, patch));
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const completedTasks = plan.stations.flatMap(station => station.tasks).filter(task => task.completed).length;
  const totalTasks = plan.stations.reduce((total, station) => total + station.tasks.length, 0);
  const completedMilestones = plan.milestones.filter(milestone => milestone.completed).length;

  return <section className="rpe-root" aria-labelledby="rpe-title">
    <div className="rpe-heading">
      <div><span className="rpl-eyebrow">YOUR RESEARCH ROADMAP</span><h3 id="rpe-title">Editable station plan</h3><p>PaperOrchestra drafted this route from your research type and starting point. Change the tasks, reorder stations and set milestone dates as your project develops.</p></div>
      <Badge>{PAPER_TYPE_LABELS[plan.paperType] ?? "Research plan"}</Badge>
    </div>
    <Card className="rpe-story-card">
      <div className="rpe-milestone-heading"><div><span className="rpl-eyebrow">THE STORY YOUR RESEARCH WILL TELL</span><h4>Research story arc</h4><p>Shape the logical journey from the problem to the contribution. Edit each beat in plain language.</p></div><Badge>{storyDrafts.length} beats</Badge></div>
      <div className="rpe-story-beats">
        {storyDrafts.map((beat, index) => <div className="rpe-story-beat" key={index}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <textarea aria-label={`Research story beat ${index + 1}`} rows={2} value={beat} onChange={event => setStoryDrafts(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} onBlur={() => onStoryArcChange(storyDrafts.map(item => item.trim()).filter(Boolean))}/>
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove story beat ${index + 1}`} onClick={() => { const next = storyDrafts.filter((_, itemIndex) => itemIndex !== index); setStoryDrafts(next); onStoryArcChange(next.filter(item => item.trim())); }}><Trash2 size={14}/></Button>
        </div>)}
      </div>
      <form className="rpe-add-story" onSubmit={event => { event.preventDefault(); if (!newStoryBeat.trim()) return; const next = [...storyDrafts, newStoryBeat.trim()]; setStoryDrafts(next); onStoryArcChange(next); setNewStoryBeat(""); }}>
        <label>Add a story beat<input value={newStoryBeat} onChange={event => setNewStoryBeat(event.target.value)} placeholder="e.g. Explain how this work could change practice"/></label>
        <Button type="submit" size="sm" variant="outline"><Plus size={14}/> Add beat</Button>
      </form>
    </Card>

    <div className="rpe-summary" aria-live="polite">
      <div><strong>{plan.stations.length}</strong><span>stations</span></div>
      <div><strong>{completedTasks}/{totalTasks}</strong><span>tasks completed</span></div>
      <div><strong>{completedMilestones}/{plan.milestones.length}</strong><span>milestones reached</span></div>
      <span className="rpe-save-note">Autosaves to this project · shared by Guided and Professional modes</span>
    </div>

    {error && <p className="rpe-error" role="alert">{error}</p>}

    <div className="rpe-stations">
      {plan.stations.map((station, index) => <Card key={station.stationId} className="rpe-station">
        <div className="rpe-station-head">
          <div className="rpe-station-title"><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{station.label}</h4><p>{station.purpose}</p></div></div>
          <div className="rpe-reorder">
            <Button type="button" variant="ghost" size="sm" disabled={index === 0} aria-label={`Move ${station.label} earlier`} onClick={() => onChange(moveResearchPlanStation(plan, index, index - 1))}><ArrowUp size={14}/></Button>
            <Button type="button" variant="ghost" size="sm" disabled={index === plan.stations.length - 1} aria-label={`Move ${station.label} later`} onClick={() => onChange(moveResearchPlanStation(plan, index, index + 1))}><ArrowDown size={14}/></Button>
          </div>
        </div>
        <div className="rpe-task-list">
          {station.tasks.map(task => {
            const draft = taskDrafts[task.id] ?? { title: task.title, description: task.description };
            return <div className="rpe-task" key={task.id}>
              <label className="rpe-complete"><input type="checkbox" checked={task.completed} onChange={event => onChange(updateResearchPlanTask(plan, task.id, { completed: event.target.checked }))}/><span className="sr-only">Mark {task.title} complete</span></label>
              <div className="rpe-task-fields">
                <input aria-label={`Task title: ${task.title}`} value={draft.title} onChange={event => setTaskDrafts(current => ({ ...current, [task.id]: { ...draft, title: event.target.value } }))} onBlur={() => commitTask(task.id)} onKeyDown={event => { if (event.key === "Enter") (event.currentTarget as HTMLInputElement).blur(); }} />
                <textarea aria-label={`Task details: ${task.title}`} rows={2} value={draft.description} onChange={event => setTaskDrafts(current => ({ ...current, [task.id]: { ...draft, description: event.target.value } }))} onBlur={() => commitTask(task.id)} />
                <span>{task.origin === "researcher" ? "Added by you" : "Suggested by blueprint"}</span>
              </div>
              {task.origin === "researcher" && <Button type="button" variant="ghost" size="sm" aria-label={`Remove task ${task.title}`} onClick={() => onChange(removeResearchPlanTask(plan, task.id))}><Trash2 size={14}/></Button>}
            </div>;
          })}
        </div>
      </Card>)}
    </div>

    <Card className="rpe-add-card">
      <form onSubmit={addTask}>
        <div><span className="rpl-eyebrow">CUSTOMIZE YOUR ROUTE</span><h4>Add a task</h4></div>
        <label>Station<select value={newTaskStation} onChange={event => setNewTaskStation(event.target.value as ResearchPlanStationId)}>{plan.stations.map(station => <option key={station.stationId} value={station.stationId}>{station.label}</option>)}</select></label>
        <label>Task title<input value={newTaskTitle} onChange={event => setNewTaskTitle(event.target.value)} placeholder="e.g. Confirm the primary outcome" required/></label>
        <label>Task details<textarea value={newTaskDescription} onChange={event => setNewTaskDescription(event.target.value)} rows={2} placeholder="Describe the work or expected output"/></label>
        <Button type="submit" size="sm"><Plus size={14}/> Add task</Button>
      </form>
    </Card>

    <div className="rpe-milestones">
      <div className="rpe-milestone-heading"><div><span className="rpl-eyebrow">PROJECT CHECKPOINTS</span><h4>Milestones and target dates</h4></div><Badge>{completedMilestones}/{plan.milestones.length} complete</Badge></div>
      {plan.milestones.map(milestone => <div className="rpe-milestone" key={milestone.id}>
        <label className="rpe-milestone-done"><input type="checkbox" checked={milestone.completed} onChange={event => updateMilestone(milestone.id, { completed: event.target.checked })}/><span className="sr-only">Mark milestone complete</span></label>
        <input aria-label={`Milestone title: ${milestone.title}`} value={milestoneDrafts[milestone.id]?.title ?? milestone.title} onChange={event => setMilestoneDrafts(current => ({ ...current, [milestone.id]: { ...(current[milestone.id] ?? { title: milestone.title, dueDate: milestone.dueDate ?? "" }), title: event.target.value } }))} onBlur={() => updateMilestone(milestone.id, { title: milestoneDrafts[milestone.id]?.title ?? milestone.title })} />
        <label className="rpe-date"><span>Target date</span><input type="date" value={milestoneDrafts[milestone.id]?.dueDate ?? milestone.dueDate ?? ""} onChange={event => setMilestoneDrafts(current => ({ ...current, [milestone.id]: { ...(current[milestone.id] ?? { title: milestone.title, dueDate: milestone.dueDate ?? "" }), dueDate: event.target.value } }))} onBlur={() => updateMilestone(milestone.id, { dueDate: milestoneDrafts[milestone.id]?.dueDate || undefined })}/></label>
      </div>)}
      <form className="rpe-add-milestone" onSubmit={addMilestone}>
        <label>New milestone<input value={newMilestoneTitle} onChange={event => setNewMilestoneTitle(event.target.value)} placeholder="e.g. Submit protocol for review" required/></label>
        <label>Target date<input type="date" value={newMilestoneDate} onChange={event => setNewMilestoneDate(event.target.value)}/></label>
        <Button type="submit" size="sm" variant="outline"><Plus size={14}/> Add milestone</Button>
      </form>
    </div>
  </section>;
}
