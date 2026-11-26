export interface ProjectDraft {
  id: string;
  name: string;
  notes: string;
  latex: string;
  bibtex: string;
  template: string;
  outline: unknown[];
  papers: unknown[];
  figures: unknown[];
  logs: string;
  agentRecords: unknown[];
  updatedAt: number;
  revision: number;
  researchQuestion: string;
  objectives: string[];
  methodology: string;
  status: "planning" | "active" | "on-hold" | "completed";
  milestones: Array<{ id: string; title: string; dueDate?: string; completed: boolean }>;
  submissionChecks: Record<string, boolean>;
  researchMode: "guided";
}
export function createProjectDraft(input: { id: string; name: string; now?: number }): ProjectDraft;
export function validateProjectDraft(project: { name?: string }): string;
export function filterProjects<T extends { name?: string; researchQuestion?: string; objectives?: string[] }>(projects: T[], query: string): T[];
export function getProjectCollection<T extends { updatedAt?: number; archivedAt?: number }>(projects: T[]): { active: T[]; archived: T[] };
export function toggleMilestone<T extends { milestones?: Array<{ id: string; title: string; dueDate?: string; completed: boolean }> }>(project: T, milestoneId: string, completed: boolean): T;
export function projectRoute(projectId: string): string;
