export interface ColumnProfile {
  name: string;
  type: "Numeric" | "Date" | "Text";
  missing: number;
  unique: number;
  min?: string;
  max?: string;
  mean?: string;
  median?: string;
}
export interface DatasetQualitySummary {
  rows: number;
  columns: number;
  missingCells: number;
  duplicateRows: number;
  completeRows: number;
}
export function profileColumn(name: string, values: string[], total?: number): ColumnProfile;
export function profileDataset(headers: string[], rows: string[][], totalRows?: number): ColumnProfile[];
export function summarizeDataset(headers: string[], rows: string[][], totalRows?: number): DatasetQualitySummary;
