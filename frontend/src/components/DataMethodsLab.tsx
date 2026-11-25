import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Database, FileSpreadsheet, Info, LoaderCircle, Search, X } from "lucide-react";
import type { Project, ProjectAttachment } from "../lib/types";
import { recommendStatisticalOptions, getStudyComplianceChecklist, createAnalysisRunManifest, executeDescriptiveAnalysis, renderAnalysisFigureSvg, approveAnalysisRunManifest, type DescriptiveAnalysisResult } from "../lib/research-analysis";
import { listResearchEntities, saveResearchEntity } from "../lib/db";
import type { ResearchEntity } from "../lib/research-blueprint";
import { MAX_DATASET_CELLS } from "../lib/phase6-regressions.mjs";
import "./data-methods-lab.css";

type Dataset = { headers: string[]; rows: string[][]; totalRows: number; truncated: boolean };
type ColumnProfile = { name: string; type: string; missing: number; unique: number; min?: string; max?: string; mean?: string; median?: string };

type ComplianceOwnerStatus = "not-reviewed" | "confirmed-by-researcher" | "not-applicable" | "requires-follow-up";
type SavedAnalysisOutput = ResearchEntity & {
  payload: {
    recordType: "analysis-output";
    summary: string;
    method: string;
    table: DescriptiveAnalysisResult["table"];
    figure: DescriptiveAnalysisResult["figure"];
    figureSvg: string;
    caption: string;
    datasetFingerprint: string;
    datasetName: string;
    rowCountAnalyzed: number;
    manifest: ReturnType<typeof createAnalysisRunManifest>;
    ownerApproved?: boolean;
    ownerReviewedAt?: number;
  };
};

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

export default function DataMethodsLab({ attachments, project }: { attachments: ProjectAttachment[]; project: Project }) {
  const csvFiles = useMemo(() => attachments.filter(file =>
    file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".tsv") ||
    file.mimeType.toLowerCase().includes("csv") || file.mimeType.toLowerCase().includes("tab-separated")
  ), [attachments]);
  const [selectedId, setSelectedId] = useState("");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [studyDesign, setStudyDesign] = useState(project.methodology || "");
  const [outcomeType, setOutcomeType] = useState<"continuous" | "binary" | "categorical" | "count" | "time-to-event" | "ordinal">("continuous");
  const [groups, setGroups] = useState(2);
  const [paired, setPaired] = useState(false);
  const [sampleSize, setSampleSize] = useState(0);
  const [analysisScript, setAnalysisScript] = useState("");
  const [outcomeColumn, setOutcomeColumn] = useState("");
  const [groupColumn, setGroupColumn] = useState("");
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisOutput, setAnalysisOutput] = useState<SavedAnalysisOutput | null>(null);
  const [savedAnalysisOutputs, setSavedAnalysisOutputs] = useState<SavedAnalysisOutput[]>([]);
  const [complianceStatuses, setComplianceStatuses] = useState<Record<string, ComplianceOwnerStatus>>({});
  const [complianceNotes, setComplianceNotes] = useState("");
  const [complianceReviewEntity, setComplianceReviewEntity] = useState<ResearchEntity | null>(null);
  const [savingCompliance, setSavingCompliance] = useState(false);
  const [complianceNotice, setComplianceNotice] = useState("");
  const [manifestNotice, setManifestNotice] = useState("");
  const [savingManifest, setSavingManifest] = useState(false);
  const variableFilterRef = useRef<HTMLInputElement | null>(null);
  const clearVariableFilter = () => {
    setFilter("");
    variableFilterRef.current?.focus();
  };

  useEffect(() => {
    let active = true;
    listResearchEntities(project.id).then(entities => {
      if (!active) return;
      const outputs = entities.filter(entity => entity.entityType === "analysis" && entity.payload.recordType === "analysis-output") as SavedAnalysisOutput[];
      outputs.sort((a, b) => b.updatedAt - a.updatedAt);
      setSavedAnalysisOutputs(outputs);
      setAnalysisOutput(outputs[0] ?? null);
      const review = entities.filter(entity => entity.entityType === "research-note" && entity.payload.recordType === "compliance-review").sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
      setComplianceReviewEntity(review);
      const savedChecklist = Array.isArray(review?.payload.checklist) ? review.payload.checklist as Array<{ id: string; ownerStatus: ComplianceOwnerStatus }> : [];
      setComplianceStatuses(Object.fromEntries(savedChecklist.map(item => [item.id, item.ownerStatus])));
      setComplianceNotes(typeof review?.payload.notes === "string" ? review.payload.notes : "");
    }).catch(() => {
      if (active) setComplianceNotice("Existing local analysis records could not be loaded.");
    });
    return () => { active = false; };
  }, [project.id]);

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

  const profiles = useMemo(() => dataset ? dataset.headers.map((name, index) =>
    profileColumn(name, dataset.rows.map(row => row[index] ?? ""), dataset.rows.length)
  ) : [], [dataset]);
  const visibleProfiles = profiles.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  const preview = dataset?.rows.slice(0, 8) ?? [];
  const statisticalGuidance = useMemo(() => recommendStatisticalOptions({ studyDesign, outcomeType, groups, paired, sampleSize }), [studyDesign, outcomeType, groups, paired, sampleSize]);
  const complianceChecklist = useMemo(() => getStudyComplianceChecklist(project.paperType, studyDesign), [project.paperType, studyDesign]);
  const saveAnalysisManifest = async () => {
    const file = csvFiles.find(item => item.id === selectedId);
    if (!file) { setManifestNotice("Select a dataset before documenting an analysis run."); return; }
    if (!analysisScript.trim()) { setManifestNotice("Add the analysis script or documented procedure first."); return; }
    setSavingManifest(true); setManifestNotice("");
    try {
      const bytes = await file.blob.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const fingerprint = "sha256:" + Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
      const manifest = createAnalysisRunManifest({ datasetId: file.id, datasetFingerprint: fingerprint, transformations: [], script: analysisScript, software: { browser: navigator.userAgent, workflow: "PaperOrchestra local Data & Methods" }, parameters: { studyDesign, outcomeType, groups, paired, sampleSize }, outputIds: [] });
      const entity: ResearchEntity = { id: "analysis:" + crypto.randomUUID(), projectId: project.id, entityType: "analysis", version: 1, status: "draft", title: "Analysis reproducibility record", payload: { recordType: "analysis-run-manifest", manifest }, provenance: { kind: "owner", sourceId: file.id, sourceLabel: "Researcher-documented local analysis plan", recordedAt: Date.now() }, createdAt: Date.now(), updatedAt: Date.now() };
      await saveResearchEntity(entity);
      setManifestNotice("Reproducibility record saved locally. It is a documented plan, not evidence that the analysis has been executed or validated.");
    } catch (cause) { setManifestNotice((cause as Error).message || "Could not save the reproducibility record."); }
    finally { setSavingManifest(false); }
  };

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

    <section className="dml-panel" aria-labelledby="dml-guidance-title">
      <div className="dml-panel-head"><div><h3 id="dml-guidance-title">Guided statistical planning</h3><p>Recommendations depend on your study design and outcome—not column types alone.</p></div><span className="dml-readonly">ADVISORY ONLY</span></div>
      <div className="dml-form-grid">
        <label>Study design<input value={studyDesign} onChange={event => setStudyDesign(event.target.value)} placeholder="e.g. cross-sectional, cohort, randomized trial"/></label>
        <label>Primary outcome type<select value={outcomeType} onChange={event => setOutcomeType(event.target.value as typeof outcomeType)}><option value="continuous">Continuous</option><option value="binary">Binary</option><option value="categorical">Categorical</option><option value="count">Count</option><option value="time-to-event">Time to event</option><option value="ordinal">Ordinal</option></select></label>
        <label>Number of groups<input type="number" min="1" max="20" value={groups} onChange={event => setGroups(Math.max(1, Number(event.target.value) || 1))}/></label>
        <label>Sample size<input type="number" min="0" value={sampleSize} onChange={event => setSampleSize(Math.max(0, Number(event.target.value) || 0))}/></label>
        <label className="dml-checkline"><input type="checkbox" checked={paired} onChange={event => setPaired(event.target.checked)}/> Paired / repeated measurements</label>
      </div>
      {statisticalGuidance.options.map(option => <article className="dml-guidance-card" key={option.method}><strong>{option.method}</strong><p>{option.rationale}</p><small>Assumptions: {option.assumptions.join(" · ")}</small><small>Limitations: {option.limitations.join(" · ")}</small></article>)}
      <ul className="dml-guidance-list">{statisticalGuidance.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
      <p className="dml-warning">These are candidate methods, not a statistical decision. Confirm the estimand, protocol, assumptions and analysis plan with the researcher or statistician before running inferential analyses.</p>
    </section>
    <section className="dml-panel" aria-labelledby="dml-compliance-title">
      <div className="dml-panel-head"><div><h3 id="dml-compliance-title">Study-specific reporting & ethics checklist</h3><p>Selected from the declared paper type and study design. Nothing is auto-confirmed.</p></div></div>
      <ul className="dml-guidance-list">{complianceChecklist.map(item => <li key={item.id}><strong>{item.guideline}:</strong> {item.label} <span>Researcher confirmation required</span></li>)}</ul>
      <p className="dml-warning">A checklist helps identify missing information; it does not certify ethics approval, consent, reporting compliance or scientific validity.</p>
    </section>
    {csvFiles.length > 0 && <section className="dml-panel" aria-labelledby="dml-repro-title">
      <div className="dml-panel-head"><div><h3 id="dml-repro-title">Reproducibility record</h3><p>Fingerprint the original dataset and document the analysis procedure before execution.</p></div></div>
      <label className="dml-script-label">Analysis script or documented procedure<textarea rows={5} value={analysisScript} onChange={event => setAnalysisScript(event.target.value)} placeholder="Paste the script or describe the exact analysis steps and transformations."/></label>
      <button type="button" className="dml-primary-action" disabled={savingManifest || !selectedId || !analysisScript.trim()} onClick={() => void saveAnalysisManifest()}>{savingManifest ? "Saving…" : "Save reproducibility record"}</button>
      {manifestNotice && <p role="status" aria-live="polite">{manifestNotice}</p>}
    </section>}
  </section>;
}
