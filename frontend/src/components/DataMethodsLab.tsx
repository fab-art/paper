import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Database, FileSpreadsheet, Info, LoaderCircle, Search, X } from "lucide-react";
import type { Project, ProjectAttachment } from "../lib/types";
import { recommendStatisticalOptions, getStudyComplianceChecklist, createAnalysisRunManifest, renderAnalysisFigureSvg, renderAnalysisTableLatex, approveAnalysisRunManifest, type AnalysisRunManifest, type DescriptiveAnalysisResult } from "../lib/research-analysis";
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
    manifest: AnalysisRunManifest;
    ownerApproved?: boolean;
    ownerReviewedAt?: number;
  };
};

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function analysisTableCsv(table: DescriptiveAnalysisResult["table"]) {
  const keys = table.rows.length ? Object.keys(table.rows[0]) : [];
  const quote = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  return [keys.map(quote).join(","), ...table.rows.map(row => keys.map(key => quote(row[key])).join(","))].join("\n");
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
      const savedDesign = typeof review?.payload.studyDesign === "string" ? review.payload.studyDesign : "";
      setStudyDesign(savedDesign || project.methodology || "");
      const savedChecklist = Array.isArray(review?.payload.checklist) ? review.payload.checklist as Array<{ id: string; ownerStatus: ComplianceOwnerStatus }> : [];
      const samePaperType = review?.payload.paperType === (project.paperType ?? "unspecified");
      setComplianceStatuses(samePaperType ? Object.fromEntries(savedChecklist.map(item => [item.id, item.ownerStatus])) : {});
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

  useEffect(() => {
    if (!dataset) {
      setOutcomeColumn("");
      setGroupColumn("");
      return;
    }
    const defaultOutcome = profiles.find(item => item.type === "Numeric") ?? profiles[0];
    setOutcomeColumn(defaultOutcome?.name ?? "");
    setGroupColumn("");
    setOutcomeType(defaultOutcome?.type === "Numeric" ? "continuous" : "categorical");
    setSampleSize(dataset.rows.length);
  }, [dataset, selectedId]);
  const preview = dataset?.rows.slice(0, 8) ?? [];
  const statisticalGuidance = useMemo(() => recommendStatisticalOptions({ studyDesign, outcomeType, groups, paired, sampleSize }), [studyDesign, outcomeType, groups, paired, sampleSize]);
  const complianceChecklist = useMemo(() => getStudyComplianceChecklist(project.paperType, studyDesign), [project.paperType, studyDesign]);
  const runDescriptiveAnalysis = async () => {
    const file = csvFiles.find(item => item.id === selectedId);
    if (!file || !dataset) { setAnalysisError("Select a fully loaded dataset before running analysis."); return; }
    if (dataset.truncated) { setAnalysisError("This dataset is truncated for preview. Use a complete dataset before analysis."); return; }
    if (!outcomeColumn) { setAnalysisError("Select an outcome variable."); return; }
    const startedAt = Date.now();
    setRunningAnalysis(true); setAnalysisError(""); setManifestNotice("");
    try {
      const result = await new Promise<DescriptiveAnalysisResult>((resolve, reject) => {
        const worker = new Worker(new URL("./research-analysis-worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<{ result?: DescriptiveAnalysisResult; error?: string }>) => {
          worker.terminate();
          if (event.data.error) reject(new Error(event.data.error));
          else if (event.data.result) resolve(event.data.result);
          else reject(new Error("The analysis worker returned an empty result."));
        };
        worker.onerror = () => {
          worker.terminate();
          reject(new Error("The local analysis worker stopped unexpectedly."));
        };
        worker.postMessage({
          datasetName: file.name,
          headers: dataset.headers,
          rows: dataset.rows,
          outcomeColumn,
          groupColumn: groupColumn || undefined,
          outcomeType,
          truncated: dataset.truncated
        });
      });
      const bytes = await file.blob.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const fingerprint = "sha256:" + Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
      const completedAt = Date.now();
      const entityId = "analysis:" + crypto.randomUUID();
      const rowSummary = result.table.rows.slice(0, 18).map(row => Object.entries(row).map(([key, value]) => key + "=" + value).join(", ")).join("; ");
      const summary = (result.method + " for " + result.outcomeColumn + " in " + file.name + " (N=" + result.rowCountAnalyzed + "). " + rowSummary).slice(0, 3200);
      const manifest = createAnalysisRunManifest({
        datasetId: file.id,
        datasetFingerprint: fingerprint,
        transformations: [],
        researcherNotes: analysisScript,
        script: result.engineVersion + " — " + result.method + "; deterministic descriptive analysis only.",
        software: { application: "PaperOrchestra Studio", analysisEngine: result.engineVersion, runtime: "Browser Web Worker", userAgent: navigator.userAgent },
        parameters: { outcomeColumn, groupColumn, outcomeType, rowCountAnalyzed: result.rowCountAnalyzed },
        outputIds: [entityId],
        execution: { status: "completed", startedAt, completedAt, durationMs: completedAt - startedAt, runtime: "Browser Web Worker", analyzedRows: result.rowCountAnalyzed, logs: [...result.logs, "Dataset SHA-256 fingerprint: " + fingerprint, "Output entity: " + entityId] }
      });
      const entity: SavedAnalysisOutput = {
        id: entityId,
        projectId: project.id,
        entityType: "analysis",
        version: 1,
        status: "draft",
        title: result.method + ": " + result.outcomeColumn,
        payload: {
          recordType: "analysis-output",
          summary,
          method: result.method,
          table: result.table,
          figure: result.figure,
          figureSvg: renderAnalysisFigureSvg(result.figure),
          caption: result.caption,
          datasetFingerprint: fingerprint,
          datasetName: file.name,
          rowCountAnalyzed: result.rowCountAnalyzed,
          manifest,
          ownerApproved: false
        },
        provenance: { kind: "owner", sourceId: file.id, sourceLabel: file.name + " · SHA-256 " + fingerprint, recordedAt: completedAt },
        createdAt: startedAt,
        updatedAt: completedAt
      };
      await saveResearchEntity(entity);
      setSavedAnalysisOutputs(current => [entity, ...current.filter(item => item.id !== entity.id)]);
      setAnalysisOutput(entity);
      setManifestNotice("Descriptive analysis executed and saved locally. The output is awaiting your review and is not yet available to writing agents.");
    } catch (cause) {
      setAnalysisError((cause as Error).message || "The descriptive analysis could not be completed.");
    } finally {
      setRunningAnalysis(false);
    }
  };

  const approveAnalysisOutput = async (output: SavedAnalysisOutput) => {
    const approvedAt = Date.now();
    const next: SavedAnalysisOutput = {
      ...output,
      status: "approved",
      version: output.version + 1,
      updatedAt: approvedAt,
      payload: {
        ...output.payload,
        ownerApproved: true,
        ownerReviewedAt: approvedAt,
        manifest: approveAnalysisRunManifest(output.payload.manifest, approvedAt)
      }
    };
    try {
      await saveResearchEntity(next);
      setSavedAnalysisOutputs(current => current.map(item => item.id === next.id ? next : item));
      setAnalysisOutput(next);
      setManifestNotice("You approved this descriptive output. Its summary can now be used as grounded writing context.");
    } catch (cause) {
      setManifestNotice("Could not save owner approval: " + (cause as Error).message);
    }
  };

  const saveComplianceReview = async () => {
    setSavingCompliance(true); setComplianceNotice("");
    const now = Date.now();
    const id = complianceReviewEntity?.id ?? "compliance:" + crypto.randomUUID();
    const checklist = complianceChecklist.map(item => ({
      ...item,
      ownerStatus: complianceStatuses[item.id] ?? "not-reviewed"
    }));
    const entity: ResearchEntity = {
      id,
      projectId: project.id,
      entityType: "research-note",
      version: (complianceReviewEntity?.version ?? 0) + 1,
      status: "draft",
      title: "Study reporting and ethics owner review",
      payload: {
        recordType: "compliance-review",
        paperType: project.paperType ?? "unspecified",
        studyDesign,
        checklist,
        notes: complianceNotes,
        ownerReviewedAt: now,
        notice: "Researcher declarations only; this record is not independent verification or certification."
      },
      provenance: { kind: "owner", sourceId: project.id, sourceLabel: "Researcher-authored compliance review", recordedAt: now },
      createdAt: complianceReviewEntity?.createdAt ?? now,
      updatedAt: now
    };
    try {
      await saveResearchEntity(entity);
      setComplianceReviewEntity(entity);
      setComplianceNotice("Owner review saved locally. Confirmations and follow-up items remain researcher declarations.");
    } catch (cause) {
      setComplianceNotice("Could not save the owner review: " + (cause as Error).message);
    } finally {
      setSavingCompliance(false);
    }
  };

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
    <section className="dml-panel" aria-labelledby="dml-execute-title">
      <div className="dml-panel-head"><div><h3 id="dml-execute-title">Run a reproducible descriptive analysis</h3><p>Execute a deterministic, local summary from the selected dataset and save its actual table, figure, caption and execution record.</p></div><span className="dml-readonly">LOCAL EXECUTION</span></div>
      {dataset && <>
        <div className="dml-form-grid">
          <label>Outcome variable<select value={outcomeColumn} onChange={event => { setOutcomeColumn(event.target.value); if (event.target.value === groupColumn) setGroupColumn(""); }}><option value="">Choose outcome</option>{dataset.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
          <label>Group by (optional)<select value={groupColumn} onChange={event => setGroupColumn(event.target.value)}><option value="">No grouping</option>{dataset.headers.filter(header => header !== outcomeColumn).map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        </div>
        <p className="dml-execution-note">The first executable release produces descriptive summaries only (mean/SD/median or counts/percentages). It does not run inferential tests, estimate causal effects or execute the statistical recommendations above. Truncated preview data cannot be analyzed.</p>
      </>}
      <button type="button" className="dml-primary-action" disabled={!dataset || dataset.truncated || !outcomeColumn || outcomeType === "time-to-event" || runningAnalysis} onClick={() => void runDescriptiveAnalysis()}>{runningAnalysis ? "Running local analysis…" : "Run descriptive analysis"}</button>
      {dataset?.truncated && <p className="dml-warning">Analysis is disabled because the preview is truncated. Load a complete dataset before execution.</p>}
      {outcomeType === "time-to-event" && <p className="dml-warning">Time-to-event inference is not supported by this descriptive runner. Use a validated survival-analysis workflow.</p>}
      {analysisError && <p className="dml-error" role="alert">{analysisError}</p>}
    </section>
    {analysisOutput && <section className="dml-panel dml-analysis-output" aria-labelledby="dml-output-title">
      <div className="dml-panel-head"><div><h3 id="dml-output-title">Executed analysis output</h3><p>{analysisOutput.payload.method} · {analysisOutput.payload.rowCountAnalyzed.toLocaleString()} rows analyzed</p></div><span className={analysisOutput.status === "approved" ? "dml-owner-status approved" : "dml-owner-status"}>{analysisOutput.status === "approved" ? "OWNER APPROVED" : "AWAITING OWNER REVIEW"}</span></div>
      {savedAnalysisOutputs.length > 1 && <label className="dml-output-history">Saved analysis runs<select value={analysisOutput.id} onChange={event => setAnalysisOutput(savedAnalysisOutputs.find(item => item.id === event.target.value) ?? analysisOutput)}>{savedAnalysisOutputs.map(item => <option key={item.id} value={item.id}>{item.title} · {item.updatedAt.toLocaleString()}</option>)}</select></label>}
      <p className="dml-output-summary">{analysisOutput.payload.summary}</p>
      <figure className="dml-publication-figure"><img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(analysisOutput.payload.figureSvg)} alt={analysisOutput.payload.figure.title}/><figcaption>{analysisOutput.payload.caption}</figcaption></figure>
      <div className="dml-table-wrap" role="region" aria-label="Executed descriptive analysis table" tabIndex={0}><table className="dml-table"><caption>{analysisOutput.payload.method} — {analysisOutput.payload.datasetName}</caption>{analysisOutput.payload.table.rows.length > 250 && <caption>Showing the first 250 of {analysisOutput.payload.table.rows.length.toLocaleString()} rows. Download the full CSV or LaTeX table for all rows.</caption>}<thead><tr>{analysisOutput.payload.table.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{analysisOutput.payload.table.rows.slice(0, 250).map((row, index) => <tr key={index}>{Object.values(row).map((value, cell) => <td key={cell}>{value === "" ? "—" : value}</td>)}</tr>)}</tbody></table></div>
      <div className="dml-output-actions">
        <button type="button" className="dml-secondary-action" onClick={() => downloadTextFile(analysisOutput.payload.datasetName.replace(/\.[^.]+$/, "") + "-descriptive-table.csv", analysisTableCsv(analysisOutput.payload.table), "text/csv;charset=utf-8")}>Download table CSV</button>
        <button type="button" className="dml-secondary-action" onClick={() => downloadTextFile("paperorchestra-figure.svg", analysisOutput.payload.figureSvg, "image/svg+xml")}>Download figure SVG</button>
        <button type="button" className="dml-secondary-action" onClick={() => downloadTextFile("paperorchestra-table.tex", renderAnalysisTableLatex(analysisOutput.payload.table, analysisOutput.payload.caption), "application/x-tex")}>Download LaTeX table</button>
        {analysisOutput.status !== "approved" && <button type="button" className="dml-primary-action" onClick={() => void approveAnalysisOutput(analysisOutput)}>Approve result for grounded writing</button>}
      </div>
      <details className="dml-provenance"><summary>Reproducibility record and execution log</summary>
        <p><strong>Dataset SHA-256:</strong> {analysisOutput.payload.datasetFingerprint}</p>
        <p><strong>Analysis engine:</strong> {analysisOutput.payload.manifest.software.analysisEngine} · {analysisOutput.payload.manifest.execution?.runtime}</p>
        <p><strong>Owner approval:</strong> {analysisOutput.payload.manifest.ownerApproved ? "Approved" : "Not yet approved"}</p>
        <ul>{analysisOutput.payload.manifest.execution?.logs.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </details>
      <p className="dml-warning">Approval means you reviewed this descriptive output for use in your manuscript. It does not certify statistical validity or replace a statistician's review.</p>
    </section>}
    <section className="dml-panel" aria-labelledby="dml-compliance-title">
      <div className="dml-panel-head"><div><h3 id="dml-compliance-title">Study-specific reporting & ethics checklist</h3><p>Selected from the declared paper type and study design. Nothing is auto-confirmed.</p></div></div>
      <ul className="dml-compliance-list">{complianceChecklist.map(item => <li key={item.id}><div><strong>{item.guideline}</strong><p>{item.label}</p></div><label>Owner declaration<select value={complianceStatuses[item.id] ?? "not-reviewed"} onChange={event => setComplianceStatuses(current => ({ ...current, [item.id]: event.target.value as ComplianceOwnerStatus }))}><option value="not-reviewed">Not reviewed</option><option value="confirmed-by-researcher">Confirmed by researcher</option><option value="not-applicable">Not applicable</option><option value="requires-follow-up">Requires follow-up</option></select></label></li>)}</ul>
      <label className="dml-script-label">Owner review notes<textarea rows={3} value={complianceNotes} onChange={event => setComplianceNotes(event.target.value)} placeholder="Record what was checked, what evidence supports the declaration, and what remains outstanding."/></label>
      <button type="button" className="dml-primary-action" disabled={savingCompliance} onClick={() => void saveComplianceReview()}>{savingCompliance ? "Saving owner review…" : "Save owner review locally"}</button>
      {complianceNotice && <p role="status" aria-live="polite">{complianceNotice}</p>}
      <p className="dml-warning">These are researcher declarations, not automated verification. “Confirmed by researcher” records your statement; it does not independently prove ethics approval, consent, registration or reporting compliance.</p>
    </section>
    {csvFiles.length > 0 && <section className="dml-panel" aria-labelledby="dml-repro-title">
      <div className="dml-panel-head"><div><h3 id="dml-repro-title">Reproducibility record</h3><p>Fingerprint the original dataset and document the analysis procedure before execution.</p></div></div>
      <label className="dml-script-label">Additional transformation notes (documentation only)<textarea rows={5} value={analysisScript} onChange={event => setAnalysisScript(event.target.value)} placeholder="Document any intended or completed transformations. These notes are recorded but are not automatically executed."/></label>
      <button type="button" className="dml-primary-action" disabled={savingManifest || !selectedId || !analysisScript.trim()} onClick={() => void saveAnalysisManifest()}>{savingManifest ? "Saving…" : "Save analysis plan only"}</button>
      {manifestNotice && <p role="status" aria-live="polite">{manifestNotice}</p>}
    </section>}
  </section>;
}
