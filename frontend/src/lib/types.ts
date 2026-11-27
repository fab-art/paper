export type AgentId = "outline" | "literature" | "plots" | "writing" | "refine";
export type AgentStatus = "idle" | "running" | "done" | "error";
export type ProjectStatus = "planning" | "active" | "on-hold" | "completed";
export interface OutlineSection { id: string; title: string; description: string; children?: OutlineSection[] }
export type PaperSource = "semantic-scholar" | "manual" | "imported";
export interface Paper { title: string; authors: string[]; source?: PaperSource; year?: number; abstract?: string; url?: string; doi?: string; venue?: string; citationCount?: number; openAccessPdf?: string; publicationDate?: string; bibtex?: string }
export interface FigureAsset { name: string; png?: string; mime?: string; pdf?: string; code?: string }
export interface AgentRecord { id: AgentId; status: AgentStatus; summary: string; updatedAt: number }
export interface ResearchMilestone { id: string; title: string; dueDate?: string; completed: boolean }

export type ReviewType = "systematic" | "scoping" | "rapid" | "other";
export type ScreeningDecision = "pending" | "include" | "exclude" | "maybe";
export type FullTextDecision = "pending" | "include" | "exclude";
export type RiskJudgement = "low" | "some-concerns" | "high" | "unclear" | "moderate" | "serious" | "critical" | "not-assessed" | "not-applicable";
export interface SystematicReviewProtocol {
  reviewType: ReviewType;
  population: string;
  intervention: string;
  comparator: string;
  outcomes: string;
  studyDesign: string;
  databases: string[];
  searchDate: string;
  startDate: string;
  endDate: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  registrationUrl: string;
}
export interface ReviewScreeningRecord {
  paperKey: string;
  titleAbstractDecision: ScreeningDecision;
  titleAbstractReason: string;
  fullTextRetrieved: boolean;
  fullTextDecision: FullTextDecision;
  fullTextReason: string;
  notes: string;
  updatedAt: number;
  titleAbstractDecisionUpdatedAt?: number;
  fullTextDecisionUpdatedAt?: number;
  fullTextRetrievedUpdatedAt?: number;
}
export interface StudyExtraction {
  studyDesign: string;
  setting: string;
  population: string;
  sampleSize: string;
  intervention: string;
  comparator: string;
  outcomes: string;
  effectEstimate: string;
  limitations: string;
  funding: string;
  sourceLocation?: string;
  supportingQuote?: string;
}
export interface RiskOfBiasDomain {
  id: string;
  name: string;
  judgement: RiskJudgement;
  rationale: string;
  guidance?: string;
  evidenceQuote?: string;
  sourceLocation?: string;
}
export interface RiskOfBiasRecord {
  tool: string;
  domains: RiskOfBiasDomain[];
  previousTools?: Record<string, RiskOfBiasRecord>;
}
export interface SystematicReviewData {
  protocol: SystematicReviewProtocol;
  screening: Record<string, ReviewScreeningRecord>;
  extraction: Record<string, StudyExtraction>;
  riskOfBias: Record<string, RiskOfBiasRecord>;
}

export type ScientificAuditFindingStatus = "not-reviewed" | "verified" | "needs-attention" | "not-applicable";
export interface ScientificAuditFinding {
  id: string; category: string; title: string; description: string; severity: "high" | "medium" | "low" | "info";
  source: string; status: ScientificAuditFindingStatus; reviewer: string; note: string; reviewedAt: number | null;
}
export interface ScientificAuditRecord {
  id: string; projectId: string; version: number; createdAt: number; updatedAt: number;
  findings: ScientificAuditFinding[];
  history: Array<{ id: string; action: string; actor: string; at: number; detail?: string; findingId?: string }>;
  signoff: { reviewer: string; signedAt: number; findingsReviewed: number; findingsNeedingAttention: number } | null;
}
export interface PublicationAuthor { id: string; name: string; affiliation: string; orcid: string; corresponding: boolean }
export type PublicationStatus = "draft" | "ready" | "submitted" | "revision" | "accepted" | "published";
export interface PublicationPlan {
  id: string; projectId: string; version: number; status: PublicationStatus; targetJournal: string; articleType: string;
  title: string; abstract: string; keywords: string[]; authors: PublicationAuthor[];
  ethicsDeclaration: string; fundingDeclaration: string; conflictOfInterest: string; dataAvailability: string;
  authorContributions: string; coverLetter: string; createdAt: number; updatedAt: number; submittedAt: number | null;
  history: Array<{ action: string; actor: string; at: number }>;
}
export interface Project {
  id: string; name: string; notes: string; latex: string; bibtex: string; template: string;
  outline: OutlineSection[]; papers: Paper[]; figures: FigureAsset[]; logs: string; templateFiles?: Record<string, string>;
  agentRecords: AgentRecord[]; updatedAt: number; revision?: number;
  researchQuestion?: string; objectives?: string[]; methodology?: string; status?: ProjectStatus; milestones?: ResearchMilestone[]; archivedAt?: number; submissionChecks?: Record<string, boolean>; systematicReview?: SystematicReviewData;
  scientificAudit?: ScientificAuditRecord;
  publicationPlan?: PublicationPlan;
  paperType?: import("./research-blueprint").ResearchPaperType;
  intendedAudience?: string;
  availableMaterials?: string[];
  storyArc?: string[];
  researchMode?: "guided" | "professional";
  startPath?: import("./research-intake").ResearchEntryPath;
  researchPlan?: import("./research-intake").ResearchStationPlan;
  productionLine?: import("./research-blueprint").ProductionLine;
  cloudProjectId?: string;
  cloudRevision?: number;
}
export interface ProjectNote { id: string; projectId: string; title: string; content: string; tags: string[]; createdAt: number; updatedAt: number }
export interface ProjectAttachment { id: string; projectId: string; name: string; mimeType: string; size: number; blob: Blob; description: string; createdAt: number }
export interface ProjectSearchHistory { id: string; projectId: string; query: string; searchedAt: number }
export const AGENTS: { id: AgentId; label: string; description: string }[] = [
  { id: "outline", label: "Outline", description: "Structure the paper" },
  { id: "literature", label: "Literature", description: "Find and ground sources" },
  { id: "plots", label: "Plots", description: "Visualize experiment data" },
  { id: "writing", label: "Writing", description: "Draft LaTeX sections" },
  { id: "refine", label: "Refine", description: "Review and polish" }
];
