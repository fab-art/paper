import type { Paper, RiskOfBiasRecord, StudyExtraction, SystematicReviewData } from "../../../../frontend/src/lib/types";
export const APPRAISAL_TEMPLATES: Readonly<Record<string, readonly (readonly [string, string, string])[]>>;
export function evidencePaperKey(paper: Partial<Paper>): string;
export function createAppraisalRecord(paper: Partial<Paper>, tool?: string): RiskOfBiasRecord;
export function createExtractionRecord(): StudyExtraction;
export function upsertEvidenceRecord(
  reviewData: SystematicReviewData | undefined,
  paper: Paper,
  changes?: { extraction?: Partial<StudyExtraction>; riskOfBias?: RiskOfBiasRecord },
  updatedAt?: number
): { key: string; data: SystematicReviewData; updatedAt: number };
export function summarizeAppraisal(record: RiskOfBiasRecord | undefined): {
  total: number; assessed: number; remaining: number; completed: boolean; high: number; concerns: number;
};
export function validateEvidenceEntry(extraction: Partial<StudyExtraction>, appraisal: RiskOfBiasRecord): string[];

export function switchAppraisalTemplate(current: RiskOfBiasRecord, paper: Partial<Paper>, tool: string): RiskOfBiasRecord;
