export const MAX_DATASET_COLUMNS: 250;
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
