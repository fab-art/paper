import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Database, FileSpreadsheet, Info, LoaderCircle, Search, X } from "lucide-react";
import type { ProjectAttachment } from "../../../../frontend/src/lib/types";
import { profileDataset, summarizeDataset } from "../domain/dataset-analysis.mjs";
import { MAX_DATASET_CELLS } from "../../../../frontend/src/lib/phase6-regressions.mjs";
import "./data-methods-lab.css";

type Dataset = { headers: string[]; rows: string[][]; totalRows: number; truncated: boolean };


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
    setLoading(true); setError(""); setDataset(null);
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
      if (active) setError((cause as Error).message || "Could not read this dataset.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; worker?.terminate(); };
  }, [csvFiles, selectedId]);

  const profiles = useMemo(() => dataset ? profileDataset(dataset.headers, dataset.rows) : [], [dataset]);
  const visibleProfiles = profiles.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  const quality = dataset ? summarizeDataset(dataset.headers, dataset.rows, dataset.totalRows) : null;
  const preview = dataset?.rows.slice(0, 8) ?? [];

  return <section className="dml-shell" aria-busy={loading}>
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
          {dataset && <div className="dml-counts" role="status" aria-live="polite"><div><strong>{dataset.totalRows.toLocaleString()}</strong><span>Rows</span></div><div><strong>{dataset.headers.length}</strong><span>Variables</span></div><div><strong>{profiles.filter(item => item.missing > 0).length}</strong><span>Columns with missing data</span></div></div>}
        </div>
        {loading && <div className="dml-loading" role="status" aria-live="polite"><LoaderCircle className="dml-spin" size={20}/> Reading dataset…</div>}
        {error && <div className="dml-error" role="alert">{error}</div>}
        {dataset && <>
          {dataset.truncated && <div className="dml-warning" role="status">The file exceeds the safe preview budget. This profile uses the first {dataset.rows.length.toLocaleString()} rows within a limit of 100,000 rows and {MAX_DATASET_CELLS.toLocaleString()} cells.</div>}
          <section className="dml-panel">
            <div className="dml-panel-head"><div><h3>Dataset quality</h3><p>{quality?.missingCells.toLocaleString()} missing cells · {quality?.duplicateRows.toLocaleString()} duplicate rows · {quality?.completeRows.toLocaleString()} complete rows in preview</p></div></div>
          </section>
          <section className="dml-panel">
            <div className="dml-panel-head"><div><h3>Variable profile</h3><p>Data type, completeness, unique values and numeric range</p></div>
              <div className="dml-filter" role="search" aria-label="Filter dataset variables"><Search size={14} aria-hidden="true"/><input ref={variableFilterRef} aria-label="Filter variables" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter variables"/>{filter && <button type="button" className="dml-clear-filter" aria-label="Clear variable filter" onClick={clearVariableFilter}><X size={13}/></button>}</div>
            </div>
            <div className="dml-table-wrap" role="region" aria-label="Variable profile table" tabIndex={0}><table className="dml-table"><caption className="dml-visually-hidden">Variable profile for the selected dataset</caption><thead><tr><th scope="col">Variable</th><th scope="col">Type</th><th scope="col">Missing</th><th scope="col">Unique</th><th scope="col">Minimum</th><th scope="col">Maximum</th><th scope="col">Mean</th><th scope="col">Median</th></tr></thead>
              <tbody>{visibleProfiles.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td><span className={"dml-type dml-" + item.type.toLowerCase()}>{item.type}</span></td><td>{item.missing.toLocaleString()} <small>({dataset.rows.length ? (item.missing / dataset.rows.length * 100).toFixed(1) : "0.0"}%)</small></td><td>{item.unique.toLocaleString()}</td><td>{item.min ?? "—"}</td><td>{item.max ?? "—"}</td><td>{item.mean ?? "—"}</td><td>{item.median ?? "—"}</td></tr>)}</tbody>
            </table></div>
            {visibleProfiles.length === 0 && <div className="dml-no-match">No variables match that filter.{filter && <button type="button" className="dml-clear-filter-action" onClick={clearVariableFilter}>Clear variable filter</button>}</div>}
          </section>
          <section className="dml-panel">
            <div className="dml-panel-head"><div><h3>Data preview</h3><p>First 8 records · read-only preview</p></div><span className="dml-readonly">READ ONLY</span></div>
            <div className="dml-table-wrap" role="region" aria-label="Data preview table" tabIndex={0}><table className="dml-table dml-preview"><caption className="dml-visually-hidden">First eight records from the selected dataset</caption><thead><tr>{dataset.headers.map((header,index)=><th scope="col" key={index}>{header}</th>)}</tr></thead>
              <tbody>{preview.map((row,index)=><tr key={index}>{dataset.headers.map((_,column)=><td key={column}>{row[column] || <span className="dml-missing">Missing</span>}</td>)}</tr>)}</tbody>
            </table></div>
          </section>
        </>}
      </>}
  </section>;
}
