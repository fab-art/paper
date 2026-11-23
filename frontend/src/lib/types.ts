export type AgentId = "outline" | "literature" | "plots" | "writing" | "refine";
export type AgentStatus = "idle" | "running" | "done" | "error";
export interface OutlineSection { id: string; title: string; description: string; children?: OutlineSection[] }
export interface Paper { title: string; authors: string[]; year?: number; abstract?: string; url?: string; doi?: string; venue?: string; citationCount?: number; openAccessPdf?: string; publicationDate?: string; bibtex?: string }
export interface FigureAsset { name: string; png?: string; mime?: string; pdf?: string; code?: string }
export interface AgentRecord { id: AgentId; status: AgentStatus; summary: string; updatedAt: number }
export interface Project {
  id: string; name: string; notes: string; latex: string; bibtex: string; template: string;
  outline: OutlineSection[]; papers: Paper[]; figures: FigureAsset[]; logs: string; templateFiles?: Record<string, string>;
  agentRecords: AgentRecord[]; updatedAt: number;
}
export const AGENTS: { id: AgentId; label: string; description: string }[] = [
  { id: "outline", label: "Outline", description: "Structure the paper" },
  { id: "literature", label: "Literature", description: "Find and ground sources" },
  { id: "plots", label: "Plots", description: "Visualize experiment data" },
  { id: "writing", label: "Writing", description: "Draft LaTeX sections" },
  { id: "refine", label: "Refine", description: "Review and polish" }
];
