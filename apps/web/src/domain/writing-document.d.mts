export interface UndefinedCitationKeyResult { key: string; }
export function insertLatexSection(latex: string, title: string, body: string): string;
export function findUndefinedCitationKeys(latex: string, bibtex: string): string[];
