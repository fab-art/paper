import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card } from "@santi020k/lumen-react";
import { AlertTriangle, BookOpenCheck, ClipboardCheck, FileSearch, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type { Project } from "../lib/types";
import type { ResearchEntity, ResearchRelation } from "../lib/research-blueprint";
import { listResearchEntities, listResearchRelations, saveResearchEntity } from "../lib/db";
import { assessJournalFit, runScientificAudit, simulateReviewerPerspectives } from "../lib/scientific-audit.mjs";
import type { ScientificAuditReport } from "../lib/scientific-audit.mjs";
import "./scientific-audit.css";

type View = "audit" | "reviewer" | "journal";
const severityVariant = (severity: string) => severity === "critical" || severity === "high" ? "destructive" : severity === "medium" ? "secondary" : "outline";

export default function ScientificAuditWorkspace({ project }: { project: Project }) {
  const [view, setView] = useState<View>("audit");
  const [report, setReport] = useState<ScientificAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalScope, setJournalScope] = useState("");
  const [journalTypes, setJournalTypes] = useState("empirical-study");
  const [journalUrl, setJournalUrl] = useState("");
  const [journalVerifiedDate, setJournalVerifiedDate] = useState("");
  const [journalApc, setJournalApc] = useState("");
  const [journalTimeline, setJournalTimeline] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextEntities, nextRelations] = await Promise.all([
        listResearchEntities(project.id), listResearchRelations(project.id)
      ]);
      const latest = nextEntities
        .filter(entity => entity.entityType === "research-note" && entity.payload.recordType === "scientific-audit-report")
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setReport(latest?.payload.report as ScientificAuditReport || null);
      const savedJournal = nextEntities.filter(entity => entity.entityType === "research-note" && entity.payload.recordType === "journal-profile").sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const profile = savedJournal?.payload.profile as Record<string, unknown> | undefined;
      if (profile) {
        setJournalTitle(String(profile.title || ""));
        setJournalScope(String(profile.aimsAndScope || ""));
        setJournalTypes(String(profile.acceptedArticleTypes || "empirical-study"));
        setJournalUrl(String(profile.sourceUrl || ""));
        setJournalVerifiedDate(String(profile.verifiedDate || ""));
        setJournalApc(String(profile.apc || ""));
        setJournalTimeline(String(profile.reviewTimeline || ""));
      }
    } catch (cause) {
      setError("Could not load the project's audit records: " + (cause as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [project.id]);

  const runAudit = async () => {
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const [latestEntities, latestRelations] = await Promise.all([
        listResearchEntities(project.id), listResearchRelations(project.id)
      ]);
      const next = runScientificAudit({ project, entities: latestEntities, relations: latestRelations });
      await saveResearchEntity({
        id: "scientific-audit:" + project.id + ":" + next.generatedAt,
        projectId: project.id,
        entityType: "research-note",
        version: 1,
        status: "draft",
        title: "Scientific audit " + new Date(next.generatedAt).toLocaleString(),
        payload: { recordType: "scientific-audit-report", report: next },
        provenance: { kind: "system", sourceId: project.id, sourceLabel: "Deterministic PaperOrchestra audit engine", recordedAt: next.generatedAt },
        createdAt: next.generatedAt,
        updatedAt: next.generatedAt
      });
      setReport(next);
      setNotice("Audit saved to this project's local research record. No manuscript content was changed.");
    } catch (cause) {
      setError("The audit could not be completed: " + (cause as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const reviewer = useMemo(() => report ? simulateReviewerPerspectives({ project, auditReport: report }) : null, [project, report]);
  const journalResult = useMemo(() => assessJournalFit({
    manuscript: { title: project.name, paperType: project.paperType, keywords: [project.name, project.researchQuestion || "", ...(project.objectives || [])] },
    journal: {
      title: journalTitle, aimsAndScope: journalScope,
      acceptedArticleTypes: journalTypes.split(",").map(value => value.trim()).filter(Boolean),
      sourceUrl: journalUrl,
      verifiedAt: journalVerifiedDate ? new Date(journalVerifiedDate).getTime() : undefined,
      apc: journalApc || null, reviewTimeline: journalTimeline || null
    }
  }), [project, journalTitle, journalScope, journalTypes, journalUrl, journalVerifiedDate, journalApc, journalTimeline]);

  const saveJournalProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const savedAt = Date.now();
    const profile = { title: journalTitle.trim(), aimsAndScope: journalScope.trim(), acceptedArticleTypes: journalTypes.trim(), sourceUrl: journalUrl.trim(), verifiedDate: journalVerifiedDate, apc: journalApc.trim(), reviewTimeline: journalTimeline.trim() };
    try {
      await saveResearchEntity({ id: "journal-profile:" + project.id, projectId: project.id, entityType: "research-note", version: 1, status: "draft", title: "Journal fit profile", payload: { recordType: "journal-profile", profile }, provenance: { kind: "owner", sourceId: project.id, sourceLabel: "Researcher-supplied journal profile", recordedAt: savedAt }, createdAt: savedAt, updatedAt: savedAt });
      setNotice("Journal profile saved locally. Source metadata remains researcher-supplied and should be checked with the journal.");
      setError("");
    } catch (cause) { setError("Could not save the journal profile: " + (cause as Error).message); }
  };
  const findings = report?.findings ?? [];

  return <section className="sa-workspace" aria-busy={loading || running}>
    <header className="sa-header">
      <div>
        <div className="sa-eyebrow"><ShieldCheck size={14}/> SCIENTIFIC QUALITY CONTROL</div>
        <h2>Inspect the research before it leaves the factory.</h2>
        <p>Run traceable checks, review prioritized fixes and pressure-test the manuscript with clearly labeled simulated reviewer perspectives.</p>
      </div>
      <div className="sa-header-actions"><span>Local project data</span><Button onClick={() => void runAudit()} disabled={running || loading}><RefreshCw size={15} className={running ? "sa-spin" : ""}/>{running ? "Inspecting…" : "Run scientific audit"}</Button></div>
    </header>

    <div className="sa-disclosure" role="note"><AlertTriangle size={16}/><span>Automated inspection is not scientific certification. Researcher assessments remain researcher assessments; reviewer prompts are simulations, not peer review.</span></div>
    <nav className="sa-tabs" aria-label="Scientific quality tools">
      <button type="button" aria-pressed={view === "audit"} className={view === "audit" ? "active" : ""} onClick={() => setView("audit")}><FileSearch size={15}/> Scientific audit</button>
      <button type="button" aria-pressed={view === "reviewer"} className={view === "reviewer" ? "active" : ""} onClick={() => setView("reviewer")}><ClipboardCheck size={15}/> Reviewer simulation</button>
      <button type="button" aria-pressed={view === "journal"} className={view === "journal" ? "active" : ""} onClick={() => setView("journal")}><BookOpenCheck size={15}/> Journal fit</button>
    </nav>
    {error && <div className="sa-alert" role="alert">{error}</div>}
    {notice && <div className="sa-notice" role="status" aria-live="polite">{notice}</div>}
    {loading ? <div className="sa-empty" role="status">Loading project quality records…</div> : view === "audit" ? <>
      {!report ? <Card className="sa-empty"><Sparkles size={24}/><h3>No audit has been run yet</h3><p>Run an inspection to check traceability, citation-key consistency, analysis approval states and research brief completeness.</p><Button onClick={() => void runAudit()} disabled={running}>Run first audit</Button></Card> : <>
        <div className="sa-metrics" aria-label="Audit summary">
          <Card><span>Findings</span><strong>{report.summary.total}</strong><small>Across deterministic checks</small></Card>
          <Card><span>Critical / high</span><strong>{report.summary.critical + report.summary.high}</strong><small>Prioritize before submission</small></Card>
          <Card><span>Medium</span><strong>{report.summary.medium}</strong><small>Needs researcher attention</small></Card>
          <Card><span>Fix cards</span><strong>{report.fixCards.length}</strong><small>Ordered by severity</small></Card>
        </div>
        <div className="sa-report-meta"><div><strong>{report.label}</strong><span>Generated {new Date(report.generatedAt).toLocaleString()}</span></div><Badge variant="outline">{report.engine}</Badge></div>
        <section className="sa-panel">
          <div className="sa-panel-title"><div><h3>Prioritized findings</h3><p>Each finding identifies the affected record and a concrete next action.</p></div><Badge variant="outline">{findings.length} findings</Badge></div>
          {findings.length ? <ol className="sa-findings">{findings.map(item => <li key={item.id}>
            <div className="sa-finding-top"><Badge variant={severityVariant(item.severity)}>{item.severity}</Badge><span>{item.category.replaceAll("-", " ")}</span></div>
            <h4>{item.title}</h4><p>{item.description}</p>
            {item.evidence && <blockquote>{item.evidence}</blockquote>}
            <div className="sa-fix"><strong>Recommended action</strong><p>{item.recommendation}</p></div>
            <small>{item.targetType}: {item.targetId}{item.location ? " · " + item.location : ""}</small>
          </li>)}</ol> : <div className="sa-empty-inline">No deterministic issues were found in the available records. This is not a guarantee of scientific validity.</div>}
        </section>
        <section className="sa-panel"><div className="sa-panel-title"><div><h3>Inspection boundaries</h3><p>What this audit does and does not establish.</p></div></div>
          <ul className="sa-scope">{Object.entries(report.scope).map(([key, value]) => <li key={key}><strong>{key.replaceAll(/([A-Z])/g, " $1")}</strong><span>{value}</span></li>)}</ul>
        </section>
      </>}
    </> : view === "reviewer" ? <section className="sa-panel">
      <div className="sa-panel-title"><div><h3>Simulated reviewer perspectives</h3><p>Structured critique prompts based on common editorial review dimensions.</p></div><Badge variant="outline">Simulation only</Badge></div>
      {!reviewer ? <div className="sa-empty-inline">Run a scientific audit first to connect known findings to reviewer prompts.</div> : <div className="sa-reviewer-grid">{reviewer.perspectives.map(item => <article key={item.id}><Badge variant="outline">Prompt only</Badge><h4>{item.title}</h4><p>{item.prompt}</p><small>{item.relatedFindingIds.length} related audit finding(s)</small></article>)}</div>}
      <p className="sa-footnote">These prompts do not represent a real reviewer, editorial decision, acceptance probability or independent scientific assessment.</p>
    </section> : <div className="sa-journal-layout">
      <section className="sa-panel"><div className="sa-panel-title"><div><h3>Journal profile</h3><p>Enter journal details from an official, current source. This tool does not invent missing data.</p></div></div>
        <form className="sa-form" onSubmit={saveJournalProfile}>
          <label>Journal name<input value={journalTitle} onChange={event => setJournalTitle(event.target.value)} placeholder="Journal title"/></label>
          <label>Aims and scope<textarea rows={5} value={journalScope} onChange={event => setJournalScope(event.target.value)} placeholder="Paste the journal's stated scope…"/></label>
          <label>Accepted article types<input value={journalTypes} onChange={event => setJournalTypes(event.target.value)} placeholder="empirical-study, systematic-review"/></label>
          <label>Official source URL<input type="url" value={journalUrl} onChange={event => setJournalUrl(event.target.value)} placeholder="https://journal.example/about"/></label>
          <label>Last verified date<input type="date" value={journalVerifiedDate} onChange={event => setJournalVerifiedDate(event.target.value)}/></label>
          <div className="sa-form-row"><label>APC (optional)<input value={journalApc} onChange={event => setJournalApc(event.target.value)} placeholder="Only if verified"/></label><label>Review timeline (optional)<input value={journalTimeline} onChange={event => setJournalTimeline(event.target.value)} placeholder="Only if verified"/></label></div>
          <Button type="submit">Save journal profile</Button>
        </form>
      </section>
      <section className="sa-panel sa-journal-result"><div className="sa-panel-title"><div><h3>Preliminary fit assessment</h3><p>Scope overlap is a screening aid, not an acceptance prediction.</p></div></div>
        <Badge variant={journalResult.status === "scope-overlap-calculated" ? "secondary" : "outline"}>{journalResult.status.replaceAll("-", " ")}</Badge>
        <div className="sa-fit-score"><strong>{journalResult.scopeFitScore === null ? "—" : journalResult.scopeFitScore + "%"}</strong><span>Scope overlap heuristic</span></div>
        <p>{journalResult.scopeOverlap.length ? "Shared terms: " + journalResult.scopeOverlap.join(", ") : "Add a journal scope and manuscript keywords to compare subject overlap."}</p>
        <dl><div><dt>Article type match</dt><dd>{journalResult.articleTypeMatch === null ? "Not assessed" : journalResult.articleTypeMatch ? "Listed" : "Not listed"}</dd></div><div><dt>APC</dt><dd>{journalResult.apc ?? "Not provided"}</dd></div><div><dt>Review timeline</dt><dd>{journalResult.reviewTimeline ?? "Not provided"}</dd></div><div><dt>Metadata</dt><dd>{journalResult.metadataStatus.replaceAll("-", " ")}</dd></div></dl>
        <p className="sa-footnote">{journalResult.warning}</p>
      </section>
    </div>}
    <footer className="sa-footer">PaperOrchestra · Researcher remains responsible for scientific judgement, interpretation and submission decisions.</footer>
  </section>;
}
