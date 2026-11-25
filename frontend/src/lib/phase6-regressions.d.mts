export const MAX_DATASET_COLUMNS: 250;
export const MAX_DATASET_CELLS: 500000;
export function canRetainDatasetRow(currentCells: number, rowCells: number): boolean;
export function safeTemplatePath(value: string): string;
export function stripLatexComments(tex: string): string;
export function extractBibtexTitles(source: string): string[];
export function assertDatasetColumnCount(count: number): void;
export type FigureAsset = { name: string; png?: string; mime?: string };
export function createUniqueFigureAssets<T extends FigureAsset>(figures: T[]): Array<T & { exportName: string; sourceIndex: number }>;
export function rewriteFigureReferences(tex: string, assets: Array<{ name: string; exportName: string }>): string;
export function parseCitationUsage(tex: string, bib: string): {
  bibliography: string[];
  citedKeys: string[];
  missing: string[];
  uncited: string[];
};
