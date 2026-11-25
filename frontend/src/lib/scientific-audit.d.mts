import type { Project } from "./types";
import type { ResearchEntity, ResearchRelation } from "./research-blueprint";

export type ScientificAuditSeverity = "critical" | "high" | "medium" | "low" | "info";
export interface ScientificAuditFinding {
  id: string; category: string; severity: ScientificAuditSeverity; title: string; description: string;
  targetType: string; targetId: string; evidence: string; recommendation: string; location: string; status: "open";
}
export interface ScientificAuditFixCard {
  id: string; findingId: string; priority: number; severity: ScientificAuditSeverity; title: string;
  targetType: string; targetId: string; location: string; action: string; status: "open";
}
export interface ScientificAuditReport {
  id: string; projectId: string; generatedAt: number; engine: string; label: string;
  findings: ScientificAuditFinding[]; fixCards: ScientificAuditFixCard[];
  summary: { total: number; critical: number; high: number; medium: number; low: number };
  scope: Record<string, string>;
}
export function runScientificAudit(input: { project: Project; entities?: ResearchEntity[]; relations?: ResearchRelation[]; now?: number }): ScientificAuditReport;
export function assessJournalFit(input: {
  manuscript?: { title?: string; paperType?: string; keywords?: string[] };
  journal?: { title?: string; aimsAndScope?: string; acceptedArticleTypes?: string[]; sourceUrl?: string; verifiedAt?: number; apc?: string | number | null; reviewTimeline?: string | null; indexing?: string[] };
}): { status: string; journalTitle: string; scopeOverlap: string[]; scopeFitScore: number | null; articleTypeMatch: boolean | null; sourceUrl: string | null; verifiedAt: number | null; metadataStatus: string; apc: string | number | null; reviewTimeline: string | null; indexing: string[]; acceptanceProbability: null; warning: string };
export function simulateReviewerPerspectives(input: { project?: Project; auditReport?: { findings?: ScientificAuditFinding[] } }): {
  kind: "simulation"; isPeerReview: false; projectId: string; label: string;
  perspectives: Array<{ id: string; title: string; prompt: string; status: "prompt-only"; relatedFindingIds: string[] }>;
};
