import type { ResearchPaperType } from "./research-blueprint";

export const RESEARCH_STATIONS = [
  { id: "intake", order: 0, label: "Research order", shortLabel: "Intake", purpose: "Clarify the problem, intended contribution, audience and available materials.", outputs: ["research brief", "candidate questions"], agentIds: ["research-planner"] },
  { id: "protocol", order: 1, label: "Planning & protocol", shortLabel: "Protocol", purpose: "Shape objectives, study design, protocol and milestones.", outputs: ["protocol", "design rationale"], agentIds: ["research-planner", "methods-advisor"] },
  { id: "literature", order: 2, label: "Literature discovery", shortLabel: "Literature", purpose: "Find, retrieve, organize and document relevant sources.", outputs: ["search log", "source library"], agentIds: ["literature-search"] },
  { id: "evidence", order: 3, label: "Evidence processing", shortLabel: "Evidence", purpose: "Screen, extract, compare and link evidence to claims.", outputs: ["evidence matrix", "claim-source links"], agentIds: ["evidence-extractor", "citation-verifier"] },
  { id: "methods", order: 4, label: "Methods & compliance", shortLabel: "Methods", purpose: "Specify variables, sampling, analysis plans, ethics and reporting requirements.", outputs: ["methods specification", "compliance checklist"], agentIds: ["methods-advisor", "compliance-reviewer"] },
  { id: "data", order: 5, label: "Data & analysis", shortLabel: "Analysis", purpose: "Profile data, prepare reproducible analyses and produce tables and figures.", outputs: ["analysis runs", "tables and figures"], agentIds: ["data-analyst", "figure-builder"] },
  { id: "writing", order: 6, label: "Manuscript assembly", shortLabel: "Writing", purpose: "Build manuscript sections from approved evidence, methods and results.", outputs: ["manuscript sections", "references"], agentIds: ["writing-coach", "clarity-editor"] },
  { id: "quality", order: 7, label: "Scientific quality control", shortLabel: "Quality", purpose: "Inspect claims, citations, calculations, consistency and reproducibility.", outputs: ["verification report", "quality findings"], agentIds: ["scientific-auditor"] },
  { id: "peer-review", order: 8, label: "Peer-review simulation", shortLabel: "Peer review", purpose: "Stress-test the manuscript and turn critique into actionable revisions.", outputs: ["reviewer report", "fix cards"], agentIds: ["reviewer-two"] },
  { id: "publication", order: 9, label: "Publication preparation", shortLabel: "Publication", purpose: "Assess journal fit and compile the submission package.", outputs: ["journal shortlist", "submission package"], agentIds: ["journal-advisor", "formatting-compiler"] },
  { id: "revision", order: 10, label: "Revisions & response", shortLabel: "Revisions", purpose: "Organize reviewer comments, rebuttal responses and manuscript changes.", outputs: ["rebuttal matrix", "revision history"], agentIds: ["rebuttal-coach"] }
] as const;

export type ResearchStationId = typeof RESEARCH_STATIONS[number]["id"];
export type ResearchTaskStatus = "queued" | "running" | "awaiting-owner" | "completed" | "failed" | "blocked" | "stale" | "canceled";
export type ResearchActor = "owner" | "agent" | "system";
export type ResearchApprovalStage = "before-run" | "after-run" | null;

export interface ResearchTask {
  id: string;
  projectId: string;
  stationId: ResearchStationId;
  title: string;
  description: string;
  status: ResearchTaskStatus;
  assignedAgentId?: string;
  dependencyTaskIds: string[];
  inputEntityIds: string[];
  outputEntityIds: string[];
  ownerApprovalBeforeRun: boolean;
  ownerApprovalRequired: boolean;
  approvalStage: ResearchApprovalStage;
  ownerApproved: boolean;
  version: number;
  runCount: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResearchApproval {
  id: string;
  projectId: string;
  taskId: string;
  decision: "approved" | "changes-requested";
  rationale: string;
  decidedByOwner: true;
  createdAt: number;
}

export interface ResearchControl {
  projectId: string;
  agentsPaused: boolean;
  updatedAt: number;
  updatedByOwner: true;
}

export interface ResearchAuditEvent {
  id: string;
  projectId: string;
  taskId?: string;
  actor: ResearchActor;
  event: string;
  details: string;
  createdAt: number;
}

export interface ResearchAgentDefinition {
  id: string;
  label: string;
  purpose: string;
  stationIds: ResearchStationId[];
  canRead: string[];
  canPropose: string[];
  canWriteDrafts: string[];
  canApprove: false;
  prohibited: string[];
}

export const RESEARCH_AGENTS: ResearchAgentDefinition[] = [
  { id: "research-planner", label: "Research Planner", purpose: "Turns an owner brief into candidate questions, objectives and a route.", stationIds: ["intake", "protocol"], canRead: ["research-brief", "project-context"], canPropose: ["research-question", "objectives", "protocol-outline"], canWriteDrafts: ["research-brief"], canApprove: false, prohibited: ["approve-research-question", "approve-protocol", "change-owner-decisions"] },
  { id: "methods-advisor", label: "Methods Advisor", purpose: "Explains design options, variables, sampling and analysis assumptions.", stationIds: ["protocol", "methods"], canRead: ["research-brief", "protocol", "dataset-profile"], canPropose: ["study-design", "analysis-plan", "methods-checklist"], canWriteDrafts: ["methods-specification"], canApprove: false, prohibited: ["select-final-method", "approve-ethics", "alter-raw-data"] },
  { id: "literature-search", label: "Literature Agent", purpose: "Expands search strategies and organizes retrieved source metadata.", stationIds: ["literature"], canRead: ["research-question", "search-history"], canPropose: ["search-queries", "source-candidates"], canWriteDrafts: ["search-log"], canApprove: false, prohibited: ["invent-sources", "make-final-screening-decisions"] },
  { id: "evidence-extractor", label: "Evidence Extractor", purpose: "Drafts structured extraction with source locations and uncertainty.", stationIds: ["evidence"], canRead: ["source-records", "source-passages"], canPropose: ["extraction-records", "evidence-links"], canWriteDrafts: ["extraction-drafts"], canApprove: false, prohibited: ["final-include-exclude", "hide-conflicting-evidence"] },
  { id: "citation-verifier", label: "Citation Verifier", purpose: "Checks whether cited passages support specific manuscript claims.", stationIds: ["evidence", "quality"], canRead: ["claims", "source-passages", "citations"], canPropose: ["claim-support-status", "citation-findings"], canWriteDrafts: ["verification-report"], canApprove: false, prohibited: ["fabricate-citations", "declare-unsupported-claims-supported"] },
  { id: "compliance-reviewer", label: "Compliance Advisor", purpose: "Maps study type to relevant reporting and ethics checklist items.", stationIds: ["methods", "quality"], canRead: ["paper-type", "study-design", "manuscript"], canPropose: ["reporting-checklist", "missing-disclosures"], canWriteDrafts: ["compliance-report"], canApprove: false, prohibited: ["invent-ethics-approval", "certify-legal-compliance"] },
  { id: "data-analyst", label: "Data & Statistics Agent", purpose: "Profiles datasets and proposes transparent, reproducible analysis plans.", stationIds: ["data"], canRead: ["dataset-metadata", "approved-analysis-plan"], canPropose: ["data-quality-findings", "statistical-options"], canWriteDrafts: ["analysis-script-draft", "analysis-report"], canApprove: false, prohibited: ["overwrite-raw-data", "choose-final-analysis-without-approval"] },
  { id: "figure-builder", label: "Figure & Table Agent", purpose: "Prepares figures and tables from actual analysis outputs.", stationIds: ["data", "writing"], canRead: ["approved-analysis-outputs"], canPropose: ["figure-layouts", "captions"], canWriteDrafts: ["figure-assets", "table-assets"], canApprove: false, prohibited: ["invent-data-points", "alter-analysis-results"] },
  { id: "writing-coach", label: "Writing Co-pilot", purpose: "Drafts section blocks using owner-approved facts and linked evidence.", stationIds: ["writing"], canRead: ["approved-protocol", "verified-evidence", "analysis-outputs", "owner-notes"], canPropose: ["paragraph-drafts", "section-outlines"], canWriteDrafts: ["manuscript-draft"], canApprove: false, prohibited: ["invent-results", "change-owner-conclusions", "submit-manuscript"] },
  { id: "clarity-editor", label: "Clarity Editor", purpose: "Improves clarity and academic tone while preserving the author's meaning.", stationIds: ["writing"], canRead: ["owner-manuscript-draft"], canPropose: ["clarity-edits"], canWriteDrafts: ["revised-draft"], canApprove: false, prohibited: ["change-scientific-meaning", "invent-evidence"] },
  { id: "scientific-auditor", label: "Scientific Auditor", purpose: "Independently inspects traceability, internal consistency and reporting completeness.", stationIds: ["quality"], canRead: ["manuscript", "evidence-graph", "analysis-logs", "protocol"], canPropose: ["quality-findings", "stale-dependencies"], canWriteDrafts: ["audit-report"], canApprove: false, prohibited: ["approve-own-work", "waive-mandatory-gates"] },
  { id: "reviewer-two", label: "Mock Reviewer #2", purpose: "Challenges logic, methods, evidence, figures and interpretation.", stationIds: ["peer-review"], canRead: ["manuscript", "methods", "evidence", "figures"], canPropose: ["reviewer-comments", "prioritized-fixes"], canWriteDrafts: ["mock-review"], canApprove: false, prohibited: ["make-final-editorial-decisions", "change-conclusions"] },
  { id: "journal-advisor", label: "Journal Fit Advisor", purpose: "Compares verified journal scope, policies, fees and timing data.", stationIds: ["publication"], canRead: ["manuscript-metadata", "journal-data"], canPropose: ["journal-shortlist", "fit-risks"], canWriteDrafts: ["journal-assessment"], canApprove: false, prohibited: ["invent-acceptance-rates", "claim-guaranteed-acceptance"] },
  { id: "formatting-compiler", label: "Formatting Compiler", purpose: "Compiles approved manuscript content into journal-specific output formats.", stationIds: ["publication"], canRead: ["approved-manuscript", "journal-template"], canPropose: ["formatting-diagnostics"], canWriteDrafts: ["submission-package"], canApprove: false, prohibited: ["submit-without-owner-authorization"] },
  { id: "rebuttal-coach", label: "Rebuttal Coach", purpose: "Groups real reviewer comments and drafts point-by-point response options.", stationIds: ["revision"], canRead: ["reviewer-comments", "manuscript-diff"], canPropose: ["response-drafts", "revision-plan"], canWriteDrafts: ["rebuttal-draft"], canApprove: false, prohibited: ["send-response-without-owner-authorization"] }
];

const ROUTES: Record<ResearchPaperType, ResearchStationId[]> = {
  "empirical-study": ["intake", "protocol", "literature", "evidence", "methods", "data", "writing", "quality", "peer-review", "publication", "revision"],
  "systematic-review": ["intake", "protocol", "literature", "evidence", "methods", "writing", "quality", "peer-review", "publication", "revision"],
  "scoping-review": ["intake", "protocol", "literature", "evidence", "methods", "writing", "quality", "peer-review", "publication", "revision"],
  "case-report": ["intake", "protocol", "literature", "methods", "writing", "quality", "peer-review", "publication", "revision"],
  "conference-paper": ["intake", "protocol", "literature", "evidence", "methods", "data", "writing", "quality", "publication"],
  "research-protocol": ["intake", "protocol", "literature", "methods", "quality", "publication"],
  "dataset-analysis": ["intake", "protocol", "literature", "methods", "data", "writing", "quality", "peer-review", "publication"],
  "existing-manuscript": ["intake", "literature", "evidence", "methods", "data", "writing", "quality", "peer-review", "publication", "revision"],
  other: ["intake", "protocol", "literature", "evidence", "methods", "data", "writing", "quality", "peer-review", "publication", "revision"],
  unspecified: ["intake", "protocol", "literature", "evidence", "methods", "data", "writing", "quality", "peer-review", "publication", "revision"]
};

export function getResearchRoute(paperType: ResearchPaperType) {
  return ROUTES[paperType].map(id => RESEARCH_STATIONS.find(station => station.id === id)!);
}

export function createResearchTask(input: {
  id: string; projectId: string; stationId: ResearchStationId; title: string; description?: string;
  assignedAgentId?: string; dependencyTaskIds?: string[]; inputEntityIds?: string[];
  ownerApprovalBeforeRun?: boolean; ownerApprovalRequired?: boolean; now?: number;
}): ResearchTask {
  const now = input.now ?? Date.now();
  const before = Boolean(input.ownerApprovalBeforeRun);
  return {
    id: input.id, projectId: input.projectId, stationId: input.stationId,
    title: input.title.trim(), description: input.description?.trim() ?? "",
    status: before ? "awaiting-owner" : "queued",
    assignedAgentId: input.assignedAgentId,
    dependencyTaskIds: [...new Set(input.dependencyTaskIds ?? [])],
    inputEntityIds: [...new Set(input.inputEntityIds ?? [])], outputEntityIds: [],
    ownerApprovalBeforeRun: before, ownerApprovalRequired: Boolean(input.ownerApprovalRequired || before || input.assignedAgentId),
    approvalStage: before ? "before-run" : null, ownerApproved: false,
    version: 1, runCount: 0, createdAt: now, updatedAt: now
  };
}

export function getReadyResearchTasks(tasks: ResearchTask[], agentsPaused = false) {
  if (agentsPaused) return [];
  const byId = new Map(tasks.map(task => [task.id, task]));
  return tasks.filter(task => task.status === "queued" && task.dependencyTaskIds.every(id => byId.get(id)?.status === "completed"));
}

export function transitionResearchTask(
  task: ResearchTask,
  action: "start" | "submit" | "approve" | "request-changes" | "retry" | "cancel" | "fail" | "mark-stale",
  actor: ResearchActor,
  tasks: ResearchTask[],
  now = Date.now(),
  ownerConfirmed = false,
  rationale = "",
  actorAgentId?: string,
  outputEntityIds: string[] = []
): { task: ResearchTask; approval?: ResearchApproval } {
  const next = { ...task, dependencyTaskIds: [...task.dependencyTaskIds], outputEntityIds: [...task.outputEntityIds] };
  const byId = new Map(tasks.map(item => [item.id, item]));
  const dependenciesReady = next.dependencyTaskIds.every(id => byId.get(id)?.status === "completed");
  let approval: ResearchApproval | undefined;

  if (action === "start") {
    if (actor !== "owner" && actor !== "agent") throw new Error("Only the owner or assigned agent can start this task.");
    if (next.status !== "queued" || !dependenciesReady) throw new Error("This task is not ready. Complete its dependencies first.");
    if (next.ownerApprovalBeforeRun && !next.ownerApproved) throw new Error("Owner approval is required before this task can start.");
    if (actor === "agent" && (!next.assignedAgentId || actorAgentId !== next.assignedAgentId)) throw new Error("Only the specialist assigned to this task can start it.");
    next.status = "running";
    next.runCount += 1;
    next.error = undefined;
  } else if (action === "submit") {
    if (next.status !== "running") throw new Error("Only a running task can submit an output.");
    if (actor === "agent" && (!next.assignedAgentId || actorAgentId !== next.assignedAgentId)) throw new Error("Only the specialist assigned to this task can submit its output.");
    next.outputEntityIds = [...new Set([...next.outputEntityIds, ...outputEntityIds])];
    next.status = next.ownerApprovalRequired ? "awaiting-owner" : "completed";
    next.approvalStage = next.ownerApprovalRequired ? "after-run" : null;
  } else if (action === "approve" || action === "request-changes") {
    if (actor !== "owner" || !ownerConfirmed) throw new Error("This decision requires explicit owner confirmation.");
    const awaitingPreRunReapproval = next.status === "queued" && next.ownerApprovalBeforeRun && !next.ownerApproved && next.approvalStage === "before-run";
    if (next.status !== "awaiting-owner" && !awaitingPreRunReapproval) throw new Error("This task is not waiting for an owner decision.");
    if (action === "approve" && (next.approvalStage === "before-run" || awaitingPreRunReapproval)) {
      next.status = "queued";
      next.ownerApproved = true;
      next.approvalStage = null;
    } else if (action === "approve") {
      next.status = "completed";
      next.ownerApproved = true;
      next.approvalStage = null;
    } else {
      next.status = "queued";
      next.ownerApproved = false;
      next.approvalStage = next.ownerApprovalBeforeRun ? "before-run" : null;
    }
    approval = {
      id: `approval:${next.id}:${now}`, projectId: next.projectId, taskId: next.id,
      decision: action === "approve" ? "approved" : "changes-requested",
      rationale: rationale.trim(), decidedByOwner: true, createdAt: now
    };
  } else if (action === "fail") {
    if (actor !== "agent" && actor !== "system") throw new Error("Only the assigned specialist or system can record an execution failure.");
    if (next.status !== "running") throw new Error("Only a running task can fail.");
    if (actor === "agent" && (!next.assignedAgentId || actorAgentId !== next.assignedAgentId)) throw new Error("Only the specialist assigned to this task can record its failure.");
    next.status = "failed";
    next.error = rationale.trim() || "Specialist execution failed.";
  } else if (action === "retry") {
    if (actor !== "owner") throw new Error("Only the owner can retry a failed or stale task.");
    if (!["failed", "blocked", "stale", "canceled"].includes(next.status)) throw new Error("Only failed, blocked, stale or canceled tasks can be retried.");
    next.status = "queued"; next.error = undefined; next.ownerApproved = false; next.approvalStage = null;
  } else if (action === "cancel") {
    if (actor !== "owner") throw new Error("Only the owner can cancel a task.");
    if (["completed", "canceled"].includes(next.status)) throw new Error("This task can no longer be canceled.");
    next.status = "canceled";
  } else {
    if (actor !== "system") throw new Error("Only the system can mark a completed task stale.");
    if (next.status !== "completed") throw new Error("Only completed tasks can become stale.");
    next.status = "stale";
  }

  next.version += 1;
  next.updatedAt = now;
  return { task: next, approval };
}

export function summarizeResearchStations(tasks: ResearchTask[], paperType: ResearchPaperType) {
  return getResearchRoute(paperType).map(station => {
    const stationTasks = tasks.filter(task => task.stationId === station.id);
    const completed = stationTasks.filter(task => task.status === "completed").length;
    const awaitingOwner = stationTasks.filter(task => task.status === "awaiting-owner").length;
    const failed = stationTasks.filter(task => task.status === "failed" || task.status === "blocked" || task.status === "stale").length;
    const active = stationTasks.filter(task => task.status === "running").length;
    const queued = stationTasks.filter(task => task.status === "queued").length;
    const status = failed ? "attention" : awaitingOwner ? "owner-review" : active ? "running" : completed && completed === stationTasks.length ? "complete" : queued ? "queued" : "not-started";
    return { ...station, taskCount: stationTasks.length, completed, awaitingOwner, failed, active, queued, status };
  });
}
