import type { Project } from "./types";

export const RESEARCH_BLUEPRINT_SCHEMA_VERSION = 1;

export type ResearchLifecycleState = "idea" | "planning" | "in-progress" | "paused" | "completed" | "publication-ready" | "archived";
export type ResearchPaperType = "empirical-study" | "systematic-review" | "scoping-review" | "case-report" | "conference-paper" | "research-protocol" | "dataset-analysis" | "existing-manuscript" | "other" | "unspecified";
export type ResearchProvenanceKind = "owner" | "agent" | "import" | "legacy-migration" | "system";
export interface ResearchProvenance { kind: ResearchProvenanceKind; sourceId?: string; sourceLabel?: string; recordedAt: number }

export interface ResearchBlueprint {
  id: string;
  projectId: string;
  schemaVersion: number;
  version: number;
  title: string;
  description: string;
  researchQuestion: string;
  objectives: string[];
  paperType: ResearchPaperType;
  intendedAudience: string;
  availableMaterials: string[];
  storyArc: string[];
  researchMode: "guided" | "professional";
  lifecycleState: ResearchLifecycleState;
  legacyProjectRevision: number;
  framework: "PICO" | "PECO" | "SPIDER" | "PICOT" | "custom";
  population: string;
  intervention: string;
  comparator: string;
  outcomes: string;
  timeframe: string;
  methodology: string;
  studyDesign: string;
  setting: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  searchSources: string[];
  analysisPlan: string;
  ethicsConsiderations: string;
  feasibilityNotes: string;
  approvalStatus: "draft" | "approved";
  approvedAt: number | null;
  approvedBy: string | null;
  provenance: ResearchProvenance;
  createdAt: number;
  updatedAt: number;
}

export type ProductionStage = "blueprint" | "literature" | "evidence" | "analysis" | "writing" | "verification" | "publication";
export type ProductionTaskStatus = "planned" | "in-progress" | "completed" | "skipped";
export interface ResearchProposedDeliverable {
  title: string;
  content: string;
  evidenceRefs: string[];
  proposalId: string;
  approvedBy: string;
  approvedAt: number;
  appliedAt: number;
}
export interface ResearchAgentProposal {
  id: string;
  contractVersion: 1;
  projectId: string;
  taskId: string;
  taskVersion: number;
  projectRevision: number;
  blueprintVersion: number | null;
  briefId: string;
  stage: ProductionStage;
  status: "proposed" | "approved" | "rejected" | "applied";
  summary: string;
  steps: string[];
  deliverables: Array<{ title: string; content: string; evidenceRefs: string[] }>;
  evidenceRefs: string[];
  limitations: string[];
  createdAt: number;
  updatedAt: number;
  approvedAt: number | null;
  approvedBy: string | null;
  appliedAt: number | null;
  auditTrail: Array<{ event: string; actor: string; at: number; detail: string }>;
}
export interface ProductionTask {
  id: string;
  title: string;
  description: string;
  stage: ProductionStage;
  dependsOn: string[];
  dueDate: string | null;
  status: ProductionTaskStatus;
  requiresApproval: boolean;
  completionConfirmedBy: string | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  version?: number;
  orchestrationProposals?: ResearchAgentProposal[];
  proposedDeliverables?: ResearchProposedDeliverable[];
}
export interface ProductionLine {
  id: string;
  projectId: string;
  schemaVersion: number;
  version: number;
  tasks: ProductionTask[];
  createdAt: number;
  updatedAt: number;
}

export type ResearchEntityType = "research-question" | "objective" | "methodology" | "source" | "outline-section" | "systematic-review" | "research-note" | "dataset" | "analysis" | "claim" | "manuscript-section";
export type ResearchEntityStatus = "draft" | "proposed" | "approved" | "verified" | "stale" | "archived";
export interface ResearchEntity<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string; projectId: string; entityType: ResearchEntityType; version: number;
  status: ResearchEntityStatus; title: string; payload: TPayload; provenance: ResearchProvenance;
  createdAt: number; updatedAt: number;
}
export interface ResearchRelation {
  id: string; projectId: string; fromEntityId: string; toEntityId: string;
  relationType: "supports" | "derived-from" | "addresses" | "cites" | "contains" | "related-to";
  provenance: ResearchProvenance; createdAt: number;
}
export interface ResearchDecision {
  id: string; projectId: string; subjectType: string; subjectId: string;
  decision: "approved" | "rejected" | "deferred" | "amended"; rationale: string;
  proposedBy: "owner" | "agent" | "system"; approvedByOwner: boolean; decidedByOwner: boolean;
  createdAt: number; updatedAt: number;
}

function stableLegacyId(projectId: string, kind: string, key: string) {
  return `legacy:${encodeURIComponent(projectId)}:${kind}:${encodeURIComponent(key)}`;
}

export function projectToResearchBlueprint(project: Project, now = Date.now(), provenanceKind: ResearchProvenanceKind = "legacy-migration"): ResearchBlueprint {
  const status = project.status ?? "planning";
  const lifecycleState: ResearchLifecycleState = status === "active" ? "in-progress" : status === "on-hold" ? "paused" : status === "completed" ? "completed" : "planning";
  return {
    id: project.id, projectId: project.id, schemaVersion: RESEARCH_BLUEPRINT_SCHEMA_VERSION, version: 1,
    title: project.name, description: project.notes ?? "", researchQuestion: project.researchQuestion ?? "",
    objectives: [...(project.objectives ?? [])],
    paperType: project.paperType && project.paperType !== "unspecified" ? project.paperType : project.systematicReview
      ? (project.systematicReview.protocol.reviewType === "scoping" ? "scoping-review" : "systematic-review")
      : project.paperType ?? "unspecified",
    intendedAudience: project.intendedAudience ?? "", availableMaterials: [...(project.availableMaterials ?? [])],
    storyArc: [...(project.storyArc ?? [])], researchMode: project.researchMode ?? "guided", lifecycleState,
    legacyProjectRevision: project.revision ?? 0,
    framework: "PICO", population: "", intervention: "", comparator: "", outcomes: "", timeframe: "",
    methodology: project.methodology ?? "", studyDesign: "", setting: "", inclusionCriteria: "", exclusionCriteria: "",
    searchSources: [], analysisPlan: "", ethicsConsiderations: "", feasibilityNotes: "",
    approvalStatus: "draft", approvedAt: null, approvedBy: null,
    provenance: { kind: provenanceKind, sourceId: project.id, sourceLabel: provenanceKind === "owner" ? "Researcher-created project" : "Existing PaperOrchestra project", recordedAt: now },
    createdAt: project.updatedAt || now, updatedAt: now
  };
}

export function legacyProjectToResearchEntities(project: Project, now = Date.now(), provenanceKind: ResearchProvenanceKind = "legacy-migration"): ResearchEntity[] {
  const provenance: ResearchProvenance = { kind: provenanceKind, sourceId: project.id, sourceLabel: provenanceKind === "owner" ? "Researcher-created project" : "Existing PaperOrchestra project", recordedAt: now };
  const entities: ResearchEntity[] = [];
  if (project.researchQuestion?.trim()) entities.push({
    id: stableLegacyId(project.id, "question", "primary"), projectId: project.id, entityType: "research-question",
    version: 1, status: "draft", title: "Primary research question", payload: { text: project.researchQuestion },
    provenance, createdAt: project.updatedAt || now, updatedAt: project.updatedAt || now
  });
  for (const [index, objective] of (project.objectives ?? []).entries()) entities.push({
    id: stableLegacyId(project.id, "objective", String(index)), projectId: project.id, entityType: "objective",
    version: 1, status: "draft", title: `Objective ${index + 1}`, payload: { text: objective, order: index },
    provenance, createdAt: project.updatedAt || now, updatedAt: project.updatedAt || now
  });
  if (project.methodology?.trim()) entities.push({
    id: stableLegacyId(project.id, "methodology", "primary"), projectId: project.id, entityType: "methodology",
    version: 1, status: "draft", title: "Research methodology", payload: { text: project.methodology },
    provenance, createdAt: project.updatedAt || now, updatedAt: project.updatedAt || now
  });
  for (const [index, paper] of project.papers.entries()) {
    const key = `${paper.doi || paper.url || paper.title}:${index}`;
    entities.push({
      id: stableLegacyId(project.id, "source", key), projectId: project.id, entityType: "source",
      version: 1, status: "draft", title: paper.title, payload: { ...paper, legacyIndex: index },
      provenance, createdAt: project.updatedAt || now, updatedAt: project.updatedAt || now
    });
  }
  const addOutline = (sections: Project["outline"], parentId?: string) => {
    for (const [index, section] of sections.entries()) {
      const id = stableLegacyId(project.id, "outline", section.id || `${parentId ?? "root"}-${index}`);
      entities.push({
        id, projectId: project.id, entityType: "outline-section", version: 1, status: "draft",
        title: section.title, payload: { description: section.description, parentId: parentId ?? null, order: index },
        provenance, createdAt: project.updatedAt || now, updatedAt: project.updatedAt || now
      });
      if (section.children?.length) addOutline(section.children, id);
    }
  };
  addOutline(project.outline ?? []);
  if (project.systematicReview) entities.push({
    id: stableLegacyId(project.id, "systematic-review", "workspace"), projectId: project.id,
    entityType: "systematic-review", version: 1, status: "draft", title: "Systematic review workspace",
    payload: { ...project.systematicReview }, provenance, createdAt: project.updatedAt || now, updatedAt: project.updatedAt || now
  });
  return entities;
}
