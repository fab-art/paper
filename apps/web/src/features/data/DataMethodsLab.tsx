import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Database, FileSpreadsheet, Info, LoaderCircle, Search, X } from "lucide-react";
import type { ProjectAttachment } from "../../../../../frontend/src/lib/types";
import { MAX_DATASET_CELLS } from "./dataMethodsModel.mjs";
import "./data-methods-lab.css";

type Dataset = { headers: string[]; rows: string[][]; totalRows: number; truncated: boolean };
type ColumnProfile = { name: string; type: string; missing: number; unique: number; min?: string; max?: string; mean?: string; median?: string };

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function profileColumn(name: string, values: string[], total: number): ColumnProfile {
  const present = values.map(value => value.trim()).filter(Boolean);
  const numeric = present.length > 0 && present.every(value => Number.isFinite(Number(value)));
  const dates = !numeric && present.length > 0 && present.every(value => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value) && Number.isFinite(Date.parse(value)));
  const numbers = numeric ? present.map(Number) : [];
  return {
    name,
    type: numeric ? "Numeric" : dates ? "Date" : "Text",
    missing: Math.max(0, total - present.length),
    unique: new Set(present).size,
    ...(numeric ? {
      min: String(numbers.reduce((value, item) => Math.min(value, item), Number.POSITIVE_INFINITY)),
      max: String(numbers.reduce((value, item) => Math.max(value, item), Number.NEGATIVE_INFINITY)),
      mean: (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2),
      median: median(numbers).toFixed(2)
    } : {})
  };
}

export default function DataMethodsLab({ attachments }: { attachments: ProjectAttachment[] }) {
  const csvFiles = useMemo(() => attachments.filter(file =>
    file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".tsv") ||
    file.mimeType.toLowerCase().includes("csv") || file.mimeType.toLowerCase().includes("tab-separated")
  ), [attachments]);
  const [selectedId, setSelectedId] = useState("");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const variableFilterRef = useRef<HTMLInputElement | null>(null);

  const clearVariableFilter = () => {
    setFilter("");
    variableFilterRef.current?.focus();
  };

  useEffect(() => {
    if (!csvFiles.length) { setSelectedId(""); setDataset(null); return; }
    if (!csvFiles.some(file => file.id === selectedId)) setSelectedId(csvFiles[0].id);
  }, [csvFiles, selectedId]);

  useEffect(() => {
    let active = true;
    let worker: Worker | undefined;
    const file = csvFiles.find(item => item.id === selectedId);
    if (!file) { setDataset(null); return; }
    setLoading(true);
    setError("");
    setDataset(null);
    const delimiter = file.name.toLowerCase().endsWith(".tsv") || file.mimeType.toLowerCase().includes("tab-separated") ? "\t" : ",";
    file.blob.text().then(source => new Promise<Dataset>((resolve, reject) => {
      if (!active) return;
      worker = new Worker(new URL("./data-methods-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<Dataset & { error?: string }>) => {
        worker?.terminate();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      worker.onerror = () => {
        worker?.terminate();
        reject(new Error("The dataset parser stopped unexpectedly. Try a smaller file or export it as CSV."));
      };
      worker.postMessage({ source: source.replace(/^\uFEFF/, ""), delimiter, maxRows: 100000 });
    })).then(result => {
      if (active) setDataset(result);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not read this dataset.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; worker?.terminate(); };
  }, [csvFiles, selectedId]);

  const profiles = useMemo(() => dataset ? dataset.headers.map((name, index) =>
    profileColumn(name, dataset.rows.map(row => row[index] ?? ""), dataset.rows.length)
  ) : [], [dataset]);
  const visibleProfiles = profiles.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  const preview = dataset?.rows.slice(0, 8) ?? [];

  return (
    <section className="data-methods-lab" aria-busy={loading} aria-labelledby="data-methods-title">
      <header className="data-methods-heading">
        <div><p className="eyebrow"><BarChart3 size={13} /> DATA & METHODS LAB</p><h2 id="data-methods-title">Understand your research data.</h2>
          <p>Inspect local datasets, check data quality and review descriptive summaries before analysis.</p></div>
        <div className="data-methods-mark"><Database size={21} /><span>Local analysis</span></div>
      </header>
      <div className="data-methods-info"><Info size={15} /><span>Files remain in this browser. This release supports CSV and TSV files up to 30 MB. Summaries are descriptive checks, not statistical inference.</span></div>
      {csvFiles.length === 0 ? <div className="data-methods-empty"><FileSpreadsheet size={28} /><strong>No tabular dataset uploaded yet</strong><p>Upload a .csv or .tsv file in the Files tab. It will appear here automatically.</p></div> :
        <>
          <div className="data-methods-dataset-bar">
            <label><span>SELECT DATASET</span><select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
              {csvFiles.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
            </select></label>
            {dataset && <div className="data-methods-counts" role="status" aria-live="polite">
              <div><strong>{dataset.totalRows.toLocaleString()}</strong><span>Rows</span></div>
              <div><strong>{dataset.headers.length}</strong><span>Variables</span></div>
              <div><strong>{profiles.filter(item => item.missing > 0).length}</strong><span>Columns with missing data</span></div>
            </div>}
          </div>
          {loading && <div className="data-methods-loading" role="status" aria-live="polite"><LoaderCircle className="data-methods-spin" size={20} /> Reading dataset…</div>}
          {error && <div className="data-methods-error" role="alert">{error}</div>}
          {dataset && <>
            {dataset.truncated && <div className="data-methods-warning" role="status">The file exceeds the safe preview budget. This profile uses the first {dataset.rows.length.toLocaleString()} rows within a limit of 100,000 rows and {MAX_DATASET_CELLS.toLocaleString()} cells.</div>}
            <section className="data-methods-panel">
              <div className="data-methods-panel-head"><div><h3>Variable profile</h3><p>Data type, completeness, unique values and numeric range</p></div>
                <div className="data-methods-filter" role="search" aria-label="Filter dataset variables"><Search size={14} aria-hidden="true" /><input ref={variableFilterRef} aria-label="Filter variables" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter variables" />{filter && <button type="button" aria-label="Clear variable filter" onClick={clearVariableFilter}><X size={13} /></button>}</div>
              </div>
              <div className="data-methods-table-wrap" role="region" aria-label="Variable profile table" tabIndex={0}>
                <table className="data-methods-table"><caption className="data-methods-visually-hidden">Variable profile for the selected dataset</caption>
                  <thead><tr><th scope="col">Variable</th><th scope="col">Type</th><th scope="col">Missing</th><th scope="col">Unique</th><th scope="col">Minimum</th><th scope="col">Maximum</th><th scope="col">Mean</th><th scope="col">Median</th></tr></thead>
                  <tbody>{visibleProfiles.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td><span className={"data-methods-type data-methods-" + item.type.toLowerCase()}>{item.type}</span></td><td>{item.missing.toLocaleString()} <small>({dataset.rows.length ? (item.missing / dataset.rows.length * 100).toFixed(1) : "0.0"}%)</small></td><td>{item.unique.toLocaleString()}</td><td>{item.min ?? "—"}</td><td>{item.max ?? "—"}</td><td>{item.mean ?? "—"}</td><td>{item.median ?? "—"}</td></tr>)}</tbody>
                </table>
              </div>
              {visibleProfiles.length === 0 && <div className="data-methods-no-match">No variables match that filter. <button type="button" onClick={clearVariableFilter}>Clear variable filter</button></div>}
            </section>
            <section className="data-methods-panel">
              <div className="data-methods-panel-head"><div><h3>Data preview</h3><p>First 8 records · read-only preview</p></div><span className="data-methods-readonly">READ ONLY</span></div>
              <div className="data-methods-table-wrap" role="region" aria-label="Data preview table" tabIndex={0}>
                <table className="data-methods-table data-methods-preview"><caption className="data-methods-visually-hidden">First eight records from the selected dataset</caption>
                  <thead><tr>{dataset.headers.map((header, index) => <th scope="col" key={index}>{header}</th>)}</tr></thead>
                  <tbody>{preview.map((row, index) => <tr key={index}>{dataset.headers.map((_, column) => <td key={column}>{row[column] || <span className="data-methods-missing">Missing</span>}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>
          </>}
        </>}
    </section>
  );
}
