import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, BookOpen, CheckCircle2, ClipboardCheck, FileSpreadsheet, Filter, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import type { Project, Paper, SystematicReviewData, SystematicReviewProtocol, ReviewScreeningRecord, StudyExtraction, RiskOfBiasDomain, ScreeningDecision, FullTextDecision, RiskJudgement } from "../lib/types";
import { calculatePrismaFlow, migrateReviewRecords, syncReviewRecords, toEvidenceMatrixCsv } from "../lib/systematic-review.mjs";
import "./systematic-review.css";

type Props = { project: Project; onUpdate: (changes: Partial<Project>) => void };
type ReviewTab = "overview" | "protocol" | "screening" | "extraction" | "bias";
type ScreeningFilter = "all" | ScreeningDecision;

const emptyProtocol = (): SystematicReviewProtocol => ({
  reviewType: "systematic", population: "", intervention: "", comparator: "", outcomes: "",
  studyDesign: "", databases: [], searchDate: "", startDate: "", endDate: "",
  inclusionCriteria: "", exclusionCriteria: "", registrationUrl: ""
});
const emptyReview = (): SystematicReviewData => ({ protocol: emptyProtocol(), screening: {}, extraction: {}, riskOfBias: {} });
const emptyExtraction = (): StudyExtraction => ({
  studyDesign: "", setting: "", population: "", sampleSize: "", intervention: "",
  comparator: "", outcomes: "", effectEstimate: "", limitations: "", funding: ""
});
const makeId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11);

function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function paperLabel(paper: Paper) {
  return [paper.authors?.slice(0, 2).join(", "), paper.year].filter(Boolean).join(" · ");
}

export default function SystematicReviewWorkspace({ project, onUpdate }: Props) {
  const [tab, setTab] = useState<ReviewTab>("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ScreeningFilter>("all");
  const [selectedPaperKey, setSelectedPaperKey] = useState("");
  const review = project.systematicReview || emptyReview();
  const synced = useMemo(() => syncReviewRecords(project.papers, review.screening), [project.papers, review.screening]);
  const migratedExtraction = useMemo(() => migrateReviewRecords(project.papers, review.extraction), [project.papers, review.extraction]);
  const migratedRiskOfBias = useMemo(() => migrateReviewRecords(project.papers, review.riskOfBias), [project.papers, review.riskOfBias]);
  const flow = useMemo(() => calculatePrismaFlow(project.papers, synced.screening), [project.papers, synced.screening]);
  const includedPapers = synced.uniquePapers.filter(paper => synced.screening[paper.reviewKey]?.fullTextDecision === "include");
  const selectedPaper = includedPapers.find(paper => paper.reviewKey === selectedPaperKey) || includedPapers[0];

  useEffect(() => {
    const nextReview = {
      ...review,
      screening: synced.screening,
      extraction: migratedExtraction,
      riskOfBias: migratedRiskOfBias
    };
    if (JSON.stringify(project.systematicReview) !== JSON.stringify(nextReview)) {
      onUpdate({ systematicReview: nextReview });
    }
  }, [project.id, project.papers, project.systematicReview, synced.screening, migratedExtraction, migratedRiskOfBias]);

  const updateReview = (changes: Partial<SystematicReviewData>) => onUpdate({ systematicReview: { ...review, ...changes } });
  const updateProtocol = (changes: Partial<SystematicReviewProtocol>) => updateReview({ protocol: { ...review.protocol, ...changes } });
  const updateScreening = (key: string, changes: Partial<ReviewScreeningRecord>) => {
    const current = synced.screening[key];
    if (!current) return;
    updateReview({ screening: { ...synced.screening, [key]: { ...current, ...changes, updatedAt: Date.now() } } });
  };
  const updateExtraction = (key: string, changes: Partial<StudyExtraction>) => {
    updateReview({ extraction: { ...migratedExtraction, [key]: { ...emptyExtraction(), ...migratedExtraction[key], ...changes } } });
  };
  const updateRisk = (key: string, changes: { tool?: string; domains?: RiskOfBiasDomain[] }) => {
    const current = migratedRiskOfBias[key] || { tool: "JBI", domains: [] };
    updateReview({ riskOfBias: { ...migratedRiskOfBias, [key]: { ...current, ...changes } } });
  };
  const visiblePapers = synced.uniquePapers.filter(paper => {
    const record = synced.screening[paper.reviewKey];
    const matchesFilter = filter === "all" || record?.titleAbstractDecision === filter;
    const haystack = [paper.title, ...(paper.authors || []), paper.doi || "", paper.abstract || ""].join(" ").toLocaleLowerCase();
    return matchesFilter && haystack.includes(search.toLocaleLowerCase());
  });

  const exportMatrix = () => {
    const csv = toEvidenceMatrixCsv(
      project.papers, synced.screening,
      migratedExtraction as unknown as Record<string, Record<string, unknown>>,
      migratedRiskOfBias as unknown as Record<string, Record<string, unknown>>
    );
    downloadFile("paperorchestra-evidence-matrix.csv", csv, "text/csv;charset=utf-8");
  };
  const exportFlow = () => downloadFile(
    "paperorchestra-prisma-flow.json",
    JSON.stringify({ project: project.name, exportedAt: new Date().toISOString(), flow }, null, 2),
    "application/json;charset=utf-8"
  );
  const setDecision = (key: string, decision: ScreeningDecision) => updateScreening(key, { titleAbstractDecision: decision });
  const addRiskDomain = (key: string) => {
    const current = review.riskOfBias[key] || { tool: "JBI", domains: [] };
    updateRisk(key, { domains: [...current.domains, { id: makeId(), name: "", judgement: "unclear", rationale: "" }] });
  };
  const updateRiskDomain = (key: string, domainId: string, changes: Partial<RiskOfBiasDomain>) => {
    const current = migratedRiskOfBias[key];
    if (current) updateRisk(key, { domains: current.domains.map(domain => domain.id === domainId ? { ...domain, ...changes } : domain) });
  };
  const removeRiskDomain = (key: string, domainId: string) => {
    const current = review.riskOfBias[key];
    if (current) updateRisk(key, { domains: current.domains.filter(domain => domain.id !== domainId) });
  };

  const flowCards = [
    ["Identified", flow.identified], ["Duplicates removed", flow.duplicatesRemoved],
    ["Screened", flow.recordsScreened], ["Excluded", flow.recordsExcluded],
    ["Reports sought", flow.reportsSought], ["Reports not retrieved", flow.reportsNotRetrieved],
    ["Full texts assessed", flow.reportsAssessed], ["Studies included", flow.studiesIncluded]
  ] as const;

  return <section className="srw-shell">
    <header className="srw-header">
      <div><div className="srw-eyebrow"><ClipboardCheck size={14}/> SYSTEMATIC REVIEW WORKSPACE</div><h2>Move from search results to traceable evidence.</h2><p>Screen the papers in this project, document decisions and build an evidence matrix. Decisions remain under researcher control.</p></div>
      <div className="srw-header-actions"><button className="srw-secondary" onClick={exportFlow}><ArrowDownToLine size={14}/> Export flow</button><button className="srw-primary" onClick={exportMatrix}><FileSpreadsheet size={14}/> Export evidence matrix</button></div>
    </header>
    <nav className="srw-tabs" aria-label="Systematic review sections">
      {([["overview","Overview"],["protocol","Protocol"],["screening","Screening"],["extraction","Data extraction"],["bias","Risk of bias"]] as [ReviewTab,string][]).map(([id,label]) =>
        <button key={id} className={tab===id?"active":""} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>
      )}
    </nav>

    {tab === "overview" && <div className="srw-overview">
      <section className="srw-panel">
        <div className="srw-panel-heading"><div><span className="srw-kicker">REVIEW PROGRESS</span><h3>PRISMA-style flow counts</h3></div><small>Calculated from recorded decisions</small></div>
        <div className="srw-flow-grid">{flowCards.map(([label,value])=><div className="srw-flow-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
        <p className="srw-disclaimer">These are working counts, not a certified PRISMA 2020 diagram. Add records to the project library and complete both screening stages before reporting final numbers.</p>
      </section>
      <section className="srw-panel">
        <div className="srw-panel-heading"><div><span className="srw-kicker">CURRENT REVIEW</span><h3>Protocol snapshot</h3></div><button className="srw-link" onClick={()=>setTab("protocol")}>Edit protocol</button></div>
        <div className="srw-protocol-grid">
          <div><span>Review type</span><strong>{review.protocol.reviewType}</strong></div>
          <div><span>Databases</span><strong>{review.protocol.databases.length?review.protocol.databases.join(", "):"Not recorded"}</strong></div>
          <div><span>Last search</span><strong>{review.protocol.searchDate||"Not recorded"}</strong></div>
          <div><span>Registration</span><strong>{review.protocol.registrationUrl?"Link recorded":"Not recorded"}</strong></div>
        </div>
      </section>
      <section className="srw-panel srw-next"><div><BookOpen size={18}/><div><strong>{flow.recordsNotScreened} record(s) awaiting title/abstract screening</strong><p>{flow.awaitingFullTextDecision} full-text decision(s) are still pending. Start with the screening queue.</p></div></div><button className="srw-primary" onClick={()=>setTab("screening")}>Open screening queue</button></section>
    </div>}

    {tab === "protocol" && <section className="srw-panel srw-form-panel">
      <div className="srw-panel-heading"><div><span className="srw-kicker">REVIEW DESIGN</span><h3>Review protocol</h3></div><small>Saved with this local project</small></div>
      <div className="srw-form-grid">
        <label>Review type<select value={review.protocol.reviewType} onChange={e=>updateProtocol({reviewType:e.target.value as SystematicReviewProtocol["reviewType"]})}><option value="systematic">Systematic review</option><option value="scoping">Scoping review</option><option value="rapid">Rapid review</option><option value="other">Other evidence synthesis</option></select></label>
        <label>Population<input value={review.protocol.population} onChange={e=>updateProtocol({population:e.target.value})} placeholder="Population or condition"/></label>
        <label>Intervention / exposure<input value={review.protocol.intervention} onChange={e=>updateProtocol({intervention:e.target.value})} placeholder="Intervention or exposure"/></label>
        <label>Comparator<input value={review.protocol.comparator} onChange={e=>updateProtocol({comparator:e.target.value})} placeholder="Comparator or usual care"/></label>
        <label>Outcomes<input value={review.protocol.outcomes} onChange={e=>updateProtocol({outcomes:e.target.value})} placeholder="Primary and secondary outcomes"/></label>
        <label>Eligible study designs<input value={review.protocol.studyDesign} onChange={e=>updateProtocol({studyDesign:e.target.value})} placeholder="e.g. RCTs, cohort studies"/></label>
        <label>Databases searched<input value={review.protocol.databases.join(", ")} onChange={e=>updateProtocol({databases:e.target.value.split(",").map(v=>v.trim()).filter(Boolean)})} placeholder="PubMed, Embase, Scopus…"/></label>
        <label>Last search date<input type="date" value={review.protocol.searchDate} onChange={e=>updateProtocol({searchDate:e.target.value})}/></label>
        <label>Search start date<input type="date" value={review.protocol.startDate} onChange={e=>updateProtocol({startDate:e.target.value})}/></label>
        <label>Search end date<input type="date" value={review.protocol.endDate} onChange={e=>updateProtocol({endDate:e.target.value})}/></label>
        <label className="srw-wide">Registration / protocol URL<input type="url" value={review.protocol.registrationUrl} onChange={e=>updateProtocol({registrationUrl:e.target.value})} placeholder="https://…"/></label>
        <label className="srw-wide">Inclusion criteria<textarea rows={4} value={review.protocol.inclusionCriteria} onChange={e=>updateProtocol({inclusionCriteria:e.target.value})} placeholder="Population, setting, design, language, dates and outcomes…"/></label>
        <label className="srw-wide">Exclusion criteria<textarea rows={4} value={review.protocol.exclusionCriteria} onChange={e=>updateProtocol({exclusionCriteria:e.target.value})} placeholder="Predefine reasons that make a record ineligible…"/></label>
      </div>
    </section>}

    {tab === "screening" && <section className="srw-panel">
      <div className="srw-panel-heading"><div><span className="srw-kicker">TITLE & ABSTRACT</span><h3>Screen project library</h3></div><small>{synced.uniquePapers.length} unique records · {synced.duplicatesRemoved} duplicates removed</small></div>
      {project.papers.length===0 ? <div className="srw-empty">Add papers in Research library or use Discover. They will appear here automatically.</div> : <>
        <div className="srw-screen-tools">
          <label className="srw-search"><Search size={14}/><input aria-label="Search papers by title, author, DOI or abstract" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search titles, authors, abstracts…"/></label>
          <label className="srw-filter"><Filter size={13}/><select aria-label="Filter screening decisions" value={filter} onChange={e=>setFilter(e.target.value as ScreeningFilter)}><option value="all">All decisions</option><option value="pending">Pending</option><option value="include">Include</option><option value="maybe">Maybe</option><option value="exclude">Exclude</option></select></label>
        </div>
        <div className="srw-screen-list">{visiblePapers.map(paper=>{
          const key=paper.reviewKey; const record=synced.screening[key];
          return <article className="srw-paper-card" key={key}>
            <div className="srw-paper-heading"><div><strong>{paper.title}</strong><p>{paperLabel(paper)||"Publication details not recorded"}{paper.doi?" · DOI: "+paper.doi:""}</p></div><span className={"srw-decision srw-"+record.titleAbstractDecision}>{record.titleAbstractDecision}</span></div>
            {paper.abstract&&<p className="srw-abstract">{paper.abstract}</p>}
            <div className="srw-decision-row"><span>Title / abstract decision</span><div>
              <button className={record.titleAbstractDecision==="include"?"chosen include":""} onClick={()=>setDecision(key,"include")}>Include</button>
              <button className={record.titleAbstractDecision==="maybe"?"chosen maybe":""} onClick={()=>setDecision(key,"maybe")}>Maybe</button>
              <button className={record.titleAbstractDecision==="exclude"?"chosen exclude":""} onClick={()=>setDecision(key,"exclude")}>Exclude</button>
              <button className={record.titleAbstractDecision==="pending"?"chosen":""} onClick={()=>setDecision(key,"pending")}>Reset</button>
            </div></div>
            <label className="srw-field">Screening reason / notes<textarea rows={2} value={record.titleAbstractReason} onChange={e=>updateScreening(key,{titleAbstractReason:e.target.value})} placeholder="Record why this paper is included, excluded or uncertain…"/></label>
            {record.titleAbstractDecision!=="pending"&&record.titleAbstractDecision!=="exclude"&&<div className="srw-fulltext">
              <label><input type="checkbox" checked={record.fullTextRetrieved} onChange={e=>updateScreening(key,{fullTextRetrieved:e.target.checked,fullTextDecision:e.target.checked?record.fullTextDecision:"pending"})}/> Full text retrieved</label>
              {record.fullTextRetrieved&&<>
                <label>Full-text decision<select value={record.fullTextDecision} onChange={e=>updateScreening(key,{fullTextDecision:e.target.value as FullTextDecision})}><option value="pending">Pending</option><option value="include">Include in review</option><option value="exclude">Exclude after full text</option></select></label>
                <label className="srw-field">Full-text reason<textarea rows={2} value={record.fullTextReason} onChange={e=>updateScreening(key,{fullTextReason:e.target.value})} placeholder="Document the full-text eligibility decision…"/></label>
              </>}
            </div>}
          </article>;
        })}{visiblePapers.length===0&&<div className="srw-empty">No records match this search and filter.</div>}</div>
      </>}
    </section>}

    {tab === "extraction" && <section className="srw-panel srw-form-panel">
      <div className="srw-panel-heading"><div><span className="srw-kicker">INCLUDED STUDIES</span><h3>Study characteristics & outcomes</h3></div><small>{includedPapers.length} included full-text study/studies</small></div>
      {includedPapers.length===0?<div className="srw-empty">Complete full-text screening and mark at least one study as included to begin extraction.</div>:<>
        <label className="srw-study-select">Study to extract<select value={selectedPaper?.reviewKey||""} onChange={e=>setSelectedPaperKey(e.target.value)}>{includedPapers.map(paper=><option key={paper.reviewKey} value={paper.reviewKey}>{paper.title}</option>)}</select></label>
        {selectedPaper&&<div className="srw-form-grid">{([
          ["studyDesign","Study design"],["setting","Country / setting"],["population","Population"],["sampleSize","Sample size"],
          ["intervention","Intervention / exposure"],["comparator","Comparator"],["outcomes","Outcomes measured"],
          ["effectEstimate","Effect estimate / key result"],["limitations","Limitations"],["funding","Funding / conflicts"]
        ] as [keyof StudyExtraction,string][]).map(([key,label])=><label className={["outcomes","effectEstimate","limitations","funding"].includes(key)?"srw-wide":""} key={key}>{label}
          {["outcomes","effectEstimate","limitations","funding"].includes(key)
            ?<textarea rows={3} value={migratedExtraction[selectedPaper.reviewKey]?.[key]||""} onChange={e=>updateExtraction(selectedPaper.reviewKey,{[key]:e.target.value})}/>
            :<input value={review.extraction[selectedPaper.reviewKey]?.[key]||""} onChange={e=>updateExtraction(selectedPaper.reviewKey,{[key]:e.target.value})}/>}
        </label>)}</div>}
      </>}
    </section>}

    {tab === "bias" && <section className="srw-panel">
      <div className="srw-panel-heading"><div><span className="srw-kicker">CRITICAL APPRAISAL</span><h3>Risk-of-bias assessment</h3></div><small>Record domain judgements and rationale</small></div>
      {includedPapers.length===0?<div className="srw-empty">Included full-text studies will appear here after screening.</div>:includedPapers.map(paper=>{
        const key=paper.reviewKey; const assessment=migratedRiskOfBias[key]||{tool:"JBI",domains:[]};
        return <article className="srw-bias-study" key={key}>
          <strong>{paper.title}</strong>
          <label className="srw-tool-select">Assessment tool<select value={assessment.tool} onChange={e=>updateRisk(key,{tool:e.target.value})}><option>JBI</option><option>RoB 2</option><option>ROBINS-I</option><option>QUADAS-2</option><option>Newcastle–Ottawa Scale</option><option>Other / adapted</option></select></label>
          {assessment.domains.map(domain=><div className="srw-domain" key={domain.id}>
            <label>Domain<input value={domain.name} onChange={e=>updateRiskDomain(key,domain.id,{name:e.target.value})} placeholder="e.g. Selection bias"/></label>
            <label>Judgement<select value={domain.judgement} onChange={e=>updateRiskDomain(key,domain.id,{judgement:e.target.value as RiskJudgement})}><option value="low">Low risk</option><option value="some-concerns">Some concerns</option><option value="high">High risk</option><option value="unclear">Unclear</option></select></label>
            <label>Rationale<textarea rows={2} value={domain.rationale} onChange={e=>updateRiskDomain(key,domain.id,{rationale:e.target.value})} placeholder="Evidence supporting this judgement…"/></label>
            <button className="srw-icon-button" type="button" aria-label="Remove appraisal domain" title="Remove domain" onClick={()=>removeRiskDomain(key,domain.id)}><Trash2 size={14}/></button>
          </div>)}
          <button className="srw-link" onClick={()=>addRiskDomain(key)}><Plus size={14}/> Add appraisal domain</button>
        </article>;
      })}
    </section>}

    <footer className="srw-footer"><span><CheckCircle2 size={13}/> Review decisions are stored with this project in this browser.</span><span><ShieldCheck size={13}/> Screening and appraisal remain researcher-led; no automatic inclusion decisions.</span></footer>
  </section>;
}
