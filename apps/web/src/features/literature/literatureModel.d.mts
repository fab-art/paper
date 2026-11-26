import type { Paper } from "../../../../../frontend/src/lib/types";

export function normalizeDoi(value: unknown): string;
export function normalizePaperTitle(value: unknown): string;
export function isSavedPaper(candidate: Partial<Paper>, savedPapers?: Paper[]): boolean;
export function safeExternalUrl(value?: string | null): string | undefined;
