import type { Paper } from "../../../../frontend/src/lib/types";
export function normalizeDoi(value: string | undefined | null): string;
export function normalizePaperTitle(value: string | undefined | null): string;
export function samePaper(left: Partial<Paper>, right: Partial<Paper>): boolean;
export function mergePaperMetadata(existing: Paper, incoming: Paper): Paper;
export function deduplicatePapers(papers: Paper[]): Paper[];
export function safeExternalUrl(value: string | undefined | null): string;
export function paperToBibtex(paper: Paper, index?: number): string;
export function appendMissingBibtex(existingBibtex: string, papers: Paper[]): string;
