export const MAX_DATASET_COLUMNS = 250;
export const MAX_DATASET_CELLS = 500000;

export function assertDatasetColumnCount(count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_DATASET_COLUMNS) {
    throw new RangeError("Dataset exceeds the safe limit of " + MAX_DATASET_COLUMNS + " columns.");
  }
}

export function canRetainDatasetRow(currentCells, rowCells) {
  return Number.isInteger(currentCells) && Number.isInteger(rowCells) &&
    currentCells >= 0 && rowCells > 0 && currentCells + rowCells <= MAX_DATASET_CELLS;
}
