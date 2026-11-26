const BLUEPRINT_SCHEMA_VERSION = 1;
const TASK_STAGES = new Set(["blueprint", "literature", "evidence", "analysis", "writing", "verification", "publication"]);
const TASK_STATUSES = new Set(["planned", "in-progress", "completed", "skipped"]);

const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export function createResearchBlueprint(project, { now = Date.now() } = {}) {
  if (!project?.id) throw new Error("A project is required to create a research blueprint.");
  return {
    id: project.id,
    projectId: project.id,
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    version: 1,
    title: project.name ?? "Untitled research",
    description: project.notes ?? "",
    researchQuestion: project.researchQuestion ?? "",
    framework: "PICO",
    population: "",
    intervention: "",
    comparator: "",
    outcomes: "",
    timeframe: "",
    objectives: [...(project.objectives ?? [])],
    paperType: project.paperType ?? "unspecified",
    intendedAudience: project.intendedAudience ?? "",
    methodology: project.methodology ?? "",
    studyDesign: "",
    setting: "",
    inclusionCriteria: "",
    exclusionCriteria: "",
    searchSources: [],
    storyArc: [...(project.storyArc ?? [])],
    researchMode: project.researchMode ?? "guided",
    lifecycleState: project.status === "active" ? "in-progress" : project.status === "on-hold" ? "paused" : project.status === "completed" ? "completed" : "planning",
    legacyProjectRevision: project.revision ?? 0,
    analysisPlan: "",
    ethicsConsiderations: "",
    feasibilityNotes: "",
    availableMaterials: [...(project.availableMaterials ?? [])],
    approvalStatus: "draft",
    approvedAt: null,
    approvedBy: null,
    provenance: { kind: "legacy-migration", sourceId: project.id, sourceLabel: "Existing local PaperOrchestra project", recordedAt: now },
    createdAt: now,
    updatedAt: now
  };
}

export function updateResearchBlueprint(blueprint, patch, { now = Date.now() } = {}) {
  if (!blueprint) throw new Error("A research blueprint is required.");
  const changed = Object.entries(patch).some(([key, value]) => JSON.stringify(blueprint[key]) !== JSON.stringify(value));
  return {
    ...blueprint,
    ...patch,
    ...(changed && blueprint.approvalStatus === "approved" ? { approvalStatus: "draft", approvedAt: null, approvedBy: null } : {}),
    updatedAt: now
  };
}

export function validateResearchBlueprint(blueprint) {
  const issues = [];
  if (!String(blueprint?.title ?? "").trim()) issues.push({ code: "title-required", message: "Add a research title." });
  if (!String(blueprint?.researchQuestion ?? "").trim()) issues.push({ code: "question-required", message: "Define the primary research question." });
  if (!Array.isArray(blueprint?.objectives) || !blueprint.objectives.some(item => String(item).trim())) {
    issues.push({ code: "objective-required", message: "Add at least one research objective." });
  }
  if (!String(blueprint?.methodology ?? "").trim() && !String(blueprint?.studyDesign ?? "").trim()) {
    issues.push({ code: "methodology-required", message: "Describe the methodology or study design." });
  }
  if (!String(blueprint?.inclusionCriteria ?? "").trim()) issues.push({ code: "inclusion-required", message: "Record inclusion criteria." });
  if (!String(blueprint?.exclusionCriteria ?? "").trim()) issues.push({ code: "exclusion-required", message: "Record exclusion criteria." });
  if (!String(blueprint?.analysisPlan ?? "").trim()) issues.push({ code: "analysis-required", message: "Describe the analysis plan." });
  return issues;
}

export function approveResearchBlueprint(blueprint, { now = Date.now(), approvedBy } = {}) {
  const issues = validateResearchBlueprint(blueprint);
  if (issues.length) throw new Error(`Blueprint is not complete: ${issues.map(issue => issue.message).join(" ")} `);
  if (!String(approvedBy ?? "").trim()) throw new Error("A researcher identity is required to approve this blueprint.");
  return {
    ...blueprint,
    version: (blueprint.version ?? 0) + 1,
    approvalStatus: "approved",
    approvedAt: now,
    approvedBy,
    updatedAt: now
  };
}

const DEFAULT_STEPS = [
  { key: "protocol", stage: "blueprint", title: "Approve research blueprint", description: "Complete and formally approve the question, objectives, design, eligibility criteria, ethics and analysis plan.", dependsOn: [] },
  { key: "literature", stage: "literature", title: "Discover and curate literature", description: "Run documented searches and curate relevant sources.", dependsOn: ["protocol"] },
  { key: "screening", stage: "evidence", title: "Screen and appraise evidence", description: "Record screening decisions, extraction and researcher-led appraisal.", dependsOn: ["literature"] },
  { key: "analysis", stage: "analysis", title: "Inspect and analyze datasets", description: "Profile data, document methods and review analytical outputs.", dependsOn: ["screening"] },
  { key: "writing", stage: "writing", title: "Draft the research manuscript", description: "Develop the manuscript using linked evidence and analysis outputs.", dependsOn: ["analysis"] },
  { key: "verification", stage: "verification", title: "Verify scientific and reporting quality", description: "Check claims, citations, methods, limitations and reporting requirements.", dependsOn: ["writing"] },
  { key: "publication", stage: "publication", title: "Prepare the publication package", description: "Prepare the final files and target-journal requirements for researcher review.", dependsOn: ["verification"] }
];

export function createProductionTask({ id = makeId("task"), title, description = "", stage = "blueprint", dependsOn = [], dueDate = "", requiresApproval = true, now = Date.now() }) {
  if (!String(title ?? "").trim()) throw new Error("Task title is required.");
  if (!TASK_STAGES.has(stage)) throw new Error("Unknown production stage.");
  if (dependsOn.includes(id)) throw new Error("A task cannot depend on itself.");
  return {
    id, title: String(title).trim(), description: String(description),
    stage, dependsOn: [...new Set(dependsOn)], dueDate: dueDate || null,
    status: "planned", requiresApproval: Boolean(requiresApproval),
    completionConfirmedBy: null, completedAt: null, createdAt: now, updatedAt: now
  };
}

export function createProductionPlan(project, { now = Date.now() } = {}) {
  if (!project?.id) throw new Error("A project is required to create a production plan.");
  if (project.productionLine) {
    return { ...project.productionLine, tasks: (project.productionLine.tasks ?? []).map(task => ({ ...task, dependsOn: [...(task.dependsOn ?? [])] })) };
  }
  const ids = Object.fromEntries(DEFAULT_STEPS.map(step => [step.key, `task:${project.id}:${step.key}`]));
  const tasks = DEFAULT_STEPS.map(step => createProductionTask({
    id: ids[step.key], title: step.title, description: step.description, stage: step.stage,
    dependsOn: step.dependsOn.map(key => ids[key]), now
  }));
  return {
    id: `production:${project.id}`, projectId: project.id, schemaVersion: 1,
    version: 1, tasks, createdAt: now, updatedAt: now
  };
}

export function getTaskReadiness(plan, taskId, { blueprintApproved = true } = {}) {
  const task = plan?.tasks?.find(item => item.id === taskId);
  if (!task) throw new Error("Production task not found.");
  const byId = new Map(plan.tasks.map(item => [item.id, item]));
  const blockedBy = task.dependsOn.filter(id => byId.get(id)?.status !== "completed");
  if (task.stage !== "blueprint" && !blueprintApproved) blockedBy.unshift("research-blueprint-approval");
  return { ready: blockedBy.length === 0, blockedBy };
}

export function addProductionTask(plan, task, { now = Date.now() } = {}) {
  if (!plan?.tasks || !task?.id) throw new Error("A valid production plan and task are required.");
  if (plan.tasks.some(item => item.id === task.id)) throw new Error("Task identifier already exists.");
  const ids = new Set(plan.tasks.map(item => item.id));
  const missing = task.dependsOn.filter(id => !ids.has(id));
  if (missing.length) throw new Error(`Unknown task dependency: ${missing.join(", ")}`);
  return { ...plan, version: (plan.version ?? 0) + 1, tasks: [...plan.tasks, { ...task, dependsOn: [...task.dependsOn] }], updatedAt: now };
}

export function updateProductionTask(plan, taskId, patch, { now = Date.now(), blueprintApproved = false } = {}) {
  const current = plan?.tasks?.find(item => item.id === taskId);
  if (!current) throw new Error("Production task not found.");
  const nextStatus = patch.status ?? current.status;
  if (!TASK_STATUSES.has(nextStatus)) throw new Error("Unknown task status.");
  if (nextStatus === "in-progress" || nextStatus === "completed") {
    const readiness = getTaskReadiness(plan, taskId, { blueprintApproved });
    if (!readiness.ready) throw new Error(`Task is blocked by incomplete dependencies: ${readiness.blockedBy.join(", ")}`);
  }
  if (nextStatus === "completed" && current.stage === "blueprint" && !blueprintApproved) {
    throw new Error("Researcher approval of the Research Blueprint is required before this task can be completed.");
  }
  if (nextStatus === "completed" && !String(patch.completionConfirmedBy ?? "").trim()) {
    throw new Error("Researcher confirmation is required to complete a task.");
  }
  const updated = {
    ...current, ...patch, status: nextStatus, updatedAt: now,
    ...(nextStatus === "completed" ? { completedAt: now } : nextStatus === "planned" ? { completedAt: null, completionConfirmedBy: null } : {})
  };
  return {
    ...plan, version: (plan.version ?? 0) + 1,
    tasks: plan.tasks.map(task => task.id === taskId ? updated : task),
    updatedAt: now
  };
}

export function getProductionProgress(plan, { blueprintApproved = true } = {}) {
  const tasks = plan?.tasks ?? [];
  const completed = tasks.filter(task => task.status === "completed").length;
  const blocked = tasks.filter(task => task.status !== "completed" && !getTaskReadiness(plan, task.id, { blueprintApproved }).ready).length;
  return {
    total: tasks.length, completed, blocked, remaining: tasks.length - completed,
    percent: tasks.length ? Math.round(completed / tasks.length * 100) : 0
  };
}
