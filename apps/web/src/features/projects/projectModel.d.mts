import type { Project, Paper } from "../../../../../frontend/src/lib/types";
import type { ResearchPaperType } from "../../../../../frontend/src/lib/research-blueprint";

export interface ProjectIntakeInput {
  name: string;
  description?: string;
  researchQuestion?: string;
  paperType?: ResearchPaperType;
  intendedAudience?: string;
  availableMaterials?: string[];
  storyArc?: string[];
  researchMode?: "guided" | "professional";
}

export function createProjectRecord(
  input: ProjectIntakeInput,
  options: { id: string; now?: number }
): Project;
export function normalizeDoi(value: string | null | undefined): string;
export function normalizePaperTitle(value: string | null | undefined): string;
export function isDuplicatePaper(papers: readonly Paper[], candidate: Paper): boolean;
export function isArchivedProject(project: Pick<Project, "archivedAt"> | null | undefined): boolean;
