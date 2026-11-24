import { useEffect, useMemo, useState } from "react";
import { BarChart3, Database, FileSpreadsheet, Info, LoaderCircle, Search } from "lucide-react";
import type { ProjectAttachment } from "../lib/types";
import "./data-methods-lab.css";

type Dataset = { headers: string[]; rows: string[][]; totalRows: number; truncated: boolean };
type ColumnProfile = { name: string; type: string; missing: number; unique: number; min?: string; max?: string; mean?: string; median?: string };

function parseCsv(source: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(item => item.some(value => value.trim() !== ""));
}

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
  const unique = new Set(present).size;
  return {
    name, type: numeric ? "Numeric" : dates ? "Date" : "Text",
    missing: Math.max(0, total - present.length), unique,
    ...(numeric ? {
      min: String(numbers.reduce((value, item) => Math.min(value, item), Number.POSITIVE_INFINITY)), max: String(numbers.reduce((value, item) => Math.max(value, item), Number.NEGATIVE_INFINITY)),
      mean: (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2),
      median: median(numbers).toFixed(2)
    } : {})
  };
}

export default function DataMethodsLab({ attachments }: { attachments: ProjectAttachment[] }) {
  const csvFiles = useMemo(() => attachments.filter(file =>
    file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".tsv") ||
    file.mimeType.includes("csv") || file.mimeType.includes("tab-separated")
  ), [attachments]);
  const [selectedId, setSelectedId] = useState("");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!csvFiles.length) { setSelectedId(""); setDataset(null); return; }
    if (!csvFiles.some(file => file.id === selectedId)) setSelectedId(csvFiles[0].id);
  }, [csvFiles, selectedId]);

  useEffect(() => {
    let active = true;
    const file = csvFiles.find(item => item.id === selectedId);
    if (!file) { setDataset(null); return; }
    setLoading(true); setError(""); setDataset(null);
    file.blob.text().then(source => {
      const parsed = parseCsv(source.replace(/^\uFEFF/, ""), file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",");
      if (parsed.length < 2) throw new Error("This file needs a header row and at least one data row.");
      const headers = parsed[0].map((value, index) => value.trim() || "Column " + (index + 1));
      const width = headers.length;
      const body = parsed.slice(1).map(row => Array.from({ length: width }, (_, index) => row[index] ?? ""));
      const capped = body.length > 100000;
      if (active) setDataset({ headers, rows: body.slice(0, 100000), totalRows: body.length, truncated: capped });
    }).catch(cause => { if (active) setError((cause as Error).message || "Could not read this dataset."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [csvFiles, selectedId]);

  const profiles = useMemo(() => dataset ? dataset.headers.map((name, index) =>
    profileColumn(name, dataset.rows.map(row => row[index] ?? ""), dataset.rows.length)
  ) : [], [dataset]);
  const visibleProfiles = profiles.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  const preview = dataset?.rows.slice(0, 8) ?? [];

  return <section className="dml-shell">
    <header className="dml-heading">
      <div><div className="dml-eyebrow"><BarChart3 size={14}/> DATA & METHODS LAB</div><h2>Understand your research data.</h2>
        <p>Inspect local datasets, check data quality and review descriptive summaries before analysis.</p></div>
      <div className="dml-mark"><Database size={22}/><span>Local analysis</span></div>
    </header>
    <div className="dml-info"><Info size={15}/><span>Files remain in this browser. This first release supports CSV and TSV files up to 30 MB. Summaries are descriptive checks, not statistical inference.</span></div>
    {csvFiles.length === 0 ? <div className="dml-empty"><FileSpreadsheet size={30}/><strong>No tabular dataset uploaded yet</strong><p>Upload a .csv or .tsv file in the Research Library. It will appear here automatically.</p></div> :
      <>
        <div className="dml-dataset-bar">
          <label><span>SELECT DATASET</span><select value={selectedId} onChange={event => setSelectedId(event.target.value)}>
            {csvFiles.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
          </select></label>
          {dataset && <div className="dml-counts"><div><strong>{dataset.totalRows.toLocaleString()}</strong><span>Rows</span></div><div><strong>{dataset.headers.length}</strong><span>Variables</span></div><div><strong>{profiles.filter(item => item.missing > 0).length}</strong><span>Columns with missing data</span></div></div>}
        </div>
        {loading && <div className="dml-loading"><LoaderCircle className="dml-spin" size={20}/> Reading dataset…</div>}
        {error && <div className="dml-error" role="alert">{error}</div>}
        {dataset && <>
          {dataset.truncated && <div className="dml-warning">The file contains more than 100,000 rows. The current profile uses the first 100,000 rows.</div>}
          <section className="dml-panel">
            <div className="dml-panel-head"><div><h3>Variable profile</h3><p>Data type, completeness, unique values and numeric range</p></div>
              <label className="dml-filter"><Search size={14}/><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter variables"/></label>
            </div>
            <div className="dml-table-wrap"><table className="dml-table"><thead><tr><th>Variable</th><th>Type</th><th>Missing</th><th>Unique</th><th>Minimum</th><th>Maximum</th><th>Mean</th><th>Median</th></tr></thead>
              <tbody>{visibleProfiles.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td><span className={"dml-type dml-" + item.type.toLowerCase()}>{item.type}</span></td><td>{item.missing.toLocaleString()} <small>({dataset.rows.length ? (item.missing / dataset.rows.length * 100).toFixed(1) : "0.0"}%)</small></td><td>{item.unique.toLocaleString()}</td><td>{item.min ?? "—"}</td><td>{item.max ?? "—"}</td><td>{item.mean ?? "—"}</td><td>{item.median ?? "—"}</td></tr>)}</tbody>
            </table></div>
            {visibleProfiles.length === 0 && <div className="dml-no-match">No variables match that filter.</div>}
          </section>
          <section className="dml-panel">
            <div className="dml-panel-head"><div><h3>Data preview</h3><p>First 8 records · read-only preview</p></div><span className="dml-readonly">READ ONLY</span></div>
            <div className="dml-table-wrap"><table className="dml-table dml-preview"><thead><tr>{dataset.headers.map((header,index)=><th key={index}>{header}</th>)}</tr></thead>
              <tbody>{preview.map((row,index)=><tr key={index}>{dataset.headers.map((_,column)=><td key={column}>{row[column] || <span className="dml-missing">Missing</span>}</td>)}</tr>)}</tbody>
            </table></div>
          </section>
        </>}
      </>}
  </section>;
}
