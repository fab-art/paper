export const MAX_DATASET_COLUMNS: number;
export const MAX_DATASET_CELLS: number;
export function assertDatasetColumnCount(count: number): void;
export function canRetainDatasetRow(currentCells: number, rowCells: number): boolean;
