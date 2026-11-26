import type { Project } from "../../../../frontend/src/lib/types";
import type { ProductionTask, ResearchAgentProposal } from "../../../../frontend/src/lib/research-blueprint";

export interface ResearchContextSource {
  id: string;
  kind: string;
  label: string;
  version?: number | null;
  sourceLocator?: string | null;
  excerpt?: string;
}
export interface ResearchTaskBrief {
  id: string;
  contractVersion: 1;
  projectId: string;
  projectRevision: number;
  projectTitle: string;
  taskId: string;
  taskTitle: string;
  taskStage: ProductionTask["stage"];
  taskStatus: ProductionTask["status"];
  taskVersion: number;
  workspacePath: string;
  objective: string;
  researchQuestion: string;
  blueprintVersion: number | null;
  contextSources: Array<ResearchContextSource & { version: number | null; sourceLocator: string | null; excerpt: string }>;
  createdAt: number;
  guardrails: string[];
}
export function getWorkspaceForResearchStage(stage: string): string | null;
export function createResearchTaskBrief(input: {
  project: Project;
  task: ProductionTask;
  plan: { tasks: ProductionTask[] };
  blueprint?: { approvalStatus?: "draft" | "approved"; version?: number; researchQuestion?: string } | null;
  contextSources?: ResearchContextSource[];
  now?: number;
}): ResearchTaskBrief;
export function buildResearchAgentPrompt(brief: ResearchTaskBrief): { system: string; user: string };
export function createResearchAgentProposal(input: {
  brief: ResearchTaskBrief;
  output: unknown;
  now?: number;
  id?: string;
}): ResearchAgentProposal;
export function decideResearchAgentProposal(
  proposal: ResearchAgentProposal,
  decision: "approve" | "reject",
  options: { actor: string; now?: number }
): ResearchAgentProposal;
export function applyApprovedResearchProposal(
  task: ProductionTask,
  proposal: ResearchAgentProposal,
  options: { expectedTaskVersion: number; actor: string; now?: number }
): { task: ProductionTask; proposal: ResearchAgentProposal };
