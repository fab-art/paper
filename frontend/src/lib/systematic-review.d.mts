export type ReviewPaper = {
  title: string;
  authors?: string[];
  year?: number;
  doi?: string;
};
export type ScreeningDecision = "pending" | "include" | "exclude" | "maybe";
export type FullTextDecision = "pending" | "include" | "exclude";
export type ScreeningRecord = {
  paperKey: string;
  titleAbstractDecision: ScreeningDecision;
  titleAbstractReason: string;
  fullTextRetrieved: boolean;
  fullTextDecision: FullTextDecision;
  fullTextReason: string;
  notes: string;
  updatedAt: number;
};
export function normalizeDoi(value: string | undefined): string;
export function normalizeTitle(value: string): string;
export function deduplicatePapers<T extends ReviewPaper>(papers: T[]): { uniquePapers: Array<T & { reviewKey: string }>; duplicatesRemoved: number };
export function migrateReviewRecords<T extends ReviewPaper, R>(papers: T[], existing?: Record<string, R>): Record<string, R>;
export function syncReviewRecords<T extends ReviewPaper>(papers: T[], existing?: Record<string, ScreeningRecord>): {
  uniquePapers: Array<T & { reviewKey: string }>;
  screening: Record<string, ScreeningRecord>;
  duplicatesRemoved: number;
};
export function calculatePrismaFlow(papers: ReviewPaper[], screening?: Record<string, ScreeningRecord>): {
  identified: number; duplicatesRemoved: number; recordsAfterDuplicates: number; recordsScreened: number;
  recordsNotScreened: number; recordsExcluded: number; reportsSought: number; reportsNotRetrieved: number;
  reportsAssessed: number; fullTextExcluded: number; studiesIncluded: number; awaitingFullTextDecision: number;
};
export function toEvidenceMatrixCsv(
  papers: ReviewPaper[],
  screening?: Record<string, ScreeningRecord>,
  extraction?: Record<string, Record<string, unknown>>,
  riskOfBias?: Record<string, Record<string, unknown>>
): string;
