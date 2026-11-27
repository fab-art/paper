import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card, Progress } from "@santi020k/lumen-react";
import { BookOpenCheck, ClipboardList, FileCheck2, Plus, ShieldAlert, Sparkles } from "lucide-react";
import type { Paper } from "../../../../frontend/src/lib/types";
import type { ResearchEntity } from "../../../../frontend/src/lib/research-blueprint";
import { assessClaimEvidence, createClaimRecord, createEvidencePassage, type EvidenceJudgement } from "../../../../frontend/src/lib/evidence-intelligence";
import { assessProtocolReadiness, createProtocolDraft, type ResearchProtocolDraft } from "../../../../frontend/src/lib/research-protocol";
import { listResearchEntities, listResearchRelations, saveResearchEntity, saveResearchRelation } from "../../../../frontend/src/lib/db";
import "./evidence-intelligence.css";

const uid = (prefix: string) => prefix + ":" + Math.random().toString(36).slice(2, 12);
const labels: Record<string, string> = {
  "awaiting-verification": "Awaiting verification", supported: "Supported", "partially-supported": "Partially supported",
  unsupported: "Unsupported", "conflicting-evidence": "Conflicting evidence"
};
const tones: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  supported: "success", "partially-supported": "warning", unsupported: "destructive",
  "conflicting-evidence": "destructive", "awaiting-verification": "secondary"
};

export default function ResearchEvidenceWorkspace({ projectId, papers }: { projectId: string; papers: Paper[] }) {
  const [view, setView] = useState<"evidence" | "protocol">("evidence");
  const [entities, setEntities] = useState<ResearchEntity[]>([]);
  const [relations, setRelations] = useState<Awaited<ReturnType<typeof listResearchRelations>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [claimText, setClaimText] = useState("");
  const [selectedClaim, setSelectedClaim] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [quote, setQuote] = useState("");
  const [locator, setLocator] = useState("");
  const [judgement, setJudgement] = useState<EvidenceJudgement>("supports");
  const [protocol, setProtocol] = useState<ResearchProtocolDraft>(() => createProtocolDraft({ projectId }));
  const [protocolId, setProtocolId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextEntities, nextRelations] = await Promise.all([listResearchEntities(projectId), listResearchRelations(projectId)]);
      setEntities(nextEntities);
      setRelations(nextRelations);
      const savedProtocol = nextEntities.find(entity => entity.entityType === "methodology" && entity.payload.recordType === "research-protocol");
      if (savedProtocol) {
        setProtocolId(savedProtocol.id);
        const candidate = savedProtocol.payload.protocol as ResearchProtocolDraft | undefined;
        if (candidate) setProtocol(candidate);
      }
      setError("");
    } catch (cause) {
      setError((cause as Error).message || "Could not load the evidence workspace.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [projectId]);

  const sources = useMemo(() => {
    const existing = entities.filter(entity => entity.entityType === "source");
    const sourceIds = new Set(existing.map(entity => String(entity.payload.doi || entity.payload.url || entity.title)));
    return [
      ...existing,
      ...papers.filter(paper => !sourceIds.has(String(paper.doi || paper.url || paper.title))).map((paper, index) => ({
        id: "project-paper:" + index + ":" + (paper.doi || paper.title),
        projectId, entityType: "source" as const, version: 1, status: "draft" as const,
        title: paper.title, payload: { ...paper }, provenance: { kind: "owner" as const, sourceLabel: "Project library reference", recordedAt: Date.now() },
        createdAt: Date.now(), updatedAt: Date.now()
      }))
    ];
  }, [entities, papers, projectId]);
  const claims = entities.filter(entity => entity.entityType === "claim");
  const passages = entities.filter(entity => entity.entityType === "research-note" && entity.payload.recordType === "evidence-passage");

  const getAssessment = (claim: ResearchEntity) => {
    const linked = relations.filter(relation => relation.toEntityId === claim.id && relation.relationType === "supports")
      .map(relation => passages.find(passage => passage.id === relation.fromEntityId))
      .filter((item): item is ResearchEntity => Boolean(item));
    return assessClaimEvidence(claim, linked.map(item => ({ id: item.id, judgement: item.payload.judgement as EvidenceJudgement })));
  };

  const addClaim = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const claim = createClaimRecord({ id: uid("claim"), projectId, text: claimText });
      await saveResearchEntity(claim);
      setClaimText(""); setSelectedClaim(claim.id);
      await refresh(); setNotice("Claim saved as awaiting verification. Add source-level evidence before relying on it.");
    } catch (cause) { setError((cause as Error).message); }
  };

  const addEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClaim || !sourceId) { setError("Select both a claim and a source record."); return; }
    try {
      const source = sources.find(item => item.id === sourceId);
      if (!source) throw new Error("The selected source is no longer available.");
      if (!entities.some(entity => entity.id === source.id)) await saveResearchEntity(source);
      const passage = createEvidencePassage({ id: uid("passage"), projectId, sourceEntityId: source.id, quote, locator });
      passage.payload.judgement = judgement;
      await saveResearchEntity(passage);
      await saveResearchRelation({
        id: uid("relation"), projectId, fromEntityId: passage.id, toEntityId: selectedClaim,
        relationType: "supports",
        provenance: { kind: "owner", sourceId: source.id, sourceLabel: "Researcher-assessed evidence link", recordedAt: Date.now() },
        createdAt: Date.now()
      });
      setQuote(""); setLocator(""); await refresh();
      setNotice("Evidence passage and source relationship saved. Its assessment remains visible for researcher review.");
    } catch (cause) { setError((cause as Error).message); }
  };

  const saveProtocol = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const readiness = assessProtocolReadiness(protocol);
      const next = { ...protocol, status: readiness.ready ? "ready-for-owner-review" as const : "draft" as const, updatedAt: Date.now(), version: protocol.version + 1 };
      const existing = entities.find(entity => entity.id === protocolId);
      await saveResearchEntity({
        id: protocolId || uid("protocol"), projectId, entityType: "methodology", version: existing?.version ?? 1,
        status: "draft", title: "Research protocol draft", payload: { recordType: "research-protocol", protocol: next },
        provenance: { kind: "owner", sourceId: projectId, sourceLabel: "Researcher-authored protocol draft", recordedAt: Date.now() },
        createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now()
      });
      setProtocol(next); await refresh();
      setNotice(readiness.ready ? "Protocol saved and marked ready for your review. It is not approved or registered." : "Protocol draft saved. Complete the remaining decisions before owner review.");
    } catch (cause) { setError((cause as Error).message); }
  };

  const readiness = assessProtocolReadiness(protocol);
  const patchProtocol = (changes: Partial<ResearchProtocolDraft>) => setProtocol(current => ({ ...current, ...changes }));
  const selected = claims.find(claim => claim.id === selectedClaim);

  return <section className="re-workspace" aria-busy={loading}>
    <header className="re-header">
      <div><div className="re-eyebrow"><Sparkles size={13}/> EVIDENCE & METHODS INTELLIGENCE</div><h2>Build research you can defend.</h2><p>Connect each claim to an inspectable source passage, then develop a protocol with explicit methodological decisions.</p></div>
      <div className="re-header-count"><BookOpenCheck size={17}/><span>{sources.length} sources in scope</span></div>
    </header>
    <div className="re-tabs" role="group" aria-label="Evidence and methods sections">
      <Button variant={view === "evidence" ? "default" : "outline"} onClick={() => setView("evidence")} aria-pressed={view === "evidence"}><BookOpenCheck size={14}/> Evidence intelligence</Button>
      <Button variant={view === "protocol" ? "default" : "outline"} onClick={() => setView("protocol")} aria-pressed={view === "protocol"}><ClipboardList size={14}/> Protocol & methods</Button>
    </div>
    {error && <div className="re-alert" role="alert">{error}</div>}
    {notice && <div className="re-notice" role="status" aria-live="polite">{notice}</div>}
    {loading ? <div className="re-loading" role="status">Loading project evidence…</div> : view === "evidence" ? <>
      <div className="re-metrics" aria-label="Evidence overview">
        <Card><span>Research claims</span><strong>{claims.length}</strong><small>Recorded in this project</small></Card>
        <Card><span>Evidence passages</span><strong>{passages.length}</strong><small>Linked to source records</small></Card>
        <Card><span>Claims awaiting verification</span><strong>{claims.filter(claim => getAssessment(claim).status === "awaiting-verification").length}</strong><small>Do not cite as established</small></Card>
        <Card><span>Conflicting evidence</span><strong>{claims.filter(claim => getAssessment(claim).status === "conflicting-evidence").length}</strong><small>Requires interpretation</small></Card>
      </div>
      <div className="re-grid">
        <Card className="re-panel">
          <div className="re-panel-title"><div><h3>Claims register</h3><p>Statements that may appear in your manuscript.</p></div><Badge variant="outline">{claims.length} claims</Badge></div>
          <form className="re-form" onSubmit={addClaim}><label>New research claim<textarea value={claimText} onChange={event => setClaimText(event.target.value)} required rows={3} placeholder="Write one specific, testable or evidence-based statement…"/></label><Button type="submit"><Plus size={14}/> Add claim</Button></form>
          <div className="re-claim-list">{claims.length ? claims.map(claim => { const assessment = getAssessment(claim); return <button type="button" key={claim.id} className={selectedClaim === claim.id ? "selected" : ""} onClick={() => setSelectedClaim(claim.id)}><span>{claim.title}</span><Badge variant={tones[assessment.status]}>{labels[assessment.status]}</Badge><small>{assessment.supportingCount + assessment.partialCount + assessment.contradictingCount + assessment.irrelevantCount} assessments</small></button>; }) : <div className="re-empty">No claims recorded yet. Start with a sentence you intend to substantiate.</div>}</div>
        </Card>
        <Card className="re-panel">
          <div className="re-panel-title"><div><h3>Source passage & assessment</h3><p>Preserve the exact text and its location in the original.</p></div><ShieldAlert size={18}/></div>
          <form className="re-form" onSubmit={addEvidence}>
            <label>Claim<select required value={selectedClaim} onChange={event => setSelectedClaim(event.target.value)}><option value="">Choose a claim</option>{claims.map(claim => <option key={claim.id} value={claim.id}>{claim.title}</option>)}</select></label>
            <label>Source<select required value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">Choose a library source</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>
            <label>Exact source passage<textarea required rows={4} value={quote} onChange={event => setQuote(event.target.value)} placeholder="Transcribe the relevant passage exactly; do not paraphrase here."/></label>
            <label>Page, table, figure or section<input value={locator} onChange={event => setLocator(event.target.value)} placeholder="e.g. p. 12, Table 2, Results"/></label>
            <label>How does this passage relate to the claim?<select value={judgement} onChange={event => setJudgement(event.target.value as EvidenceJudgement)}><option value="supports">Supports</option><option value="partially-supports">Partially supports</option><option value="contradicts">Contradicts</option><option value="irrelevant">Does not support / irrelevant</option></select></label>
            <Button type="submit" disabled={!claims.length || !sources.length}><Plus size={14}/> Record evidence assessment</Button>
          </form>
          {selected && <div className="re-assessment"><span>Current claim status</span><Badge variant={tones[getAssessment(selected).status]}>{labels[getAssessment(selected).status]}</Badge><p>Assessment is based only on passages explicitly linked by the researcher. Relevance or keyword similarity is not proof of support.</p></div>}
        </Card>
      </div>
      <Card className="re-panel re-passages"><div className="re-panel-title"><div><h3>Evidence trail</h3><p>Each passage remains traceable to its source and location.</p></div><Badge variant="outline">{passages.length} passages</Badge></div>
        {passages.map(passage => { const source = sources.find(item => item.id === passage.payload.sourceEntityId); const linkedClaim = claims.find(claim => relations.some(relation => relation.fromEntityId === passage.id && relation.toEntityId === claim.id)); return <article key={passage.id}><div><strong>{passage.title}</strong><p>“{String(passage.payload.quote || "")}”</p><small>{source?.title || "Source record unavailable"} · {String(passage.payload.locator || "Location not recorded")}</small></div><Badge variant={tones[String(passage.payload.judgement)] || "secondary"}>{String(passage.payload.judgement || "unassessed").replaceAll("-", " ")}</Badge><span>{linkedClaim?.title || "Unlinked claim"}</span></article>; })}
        {!passages.length && <div className="re-empty">Source passages will appear here after you record an assessment.</div>}
      </Card>
      <p className="re-integrity-note"><ShieldAlert size={14}/> PaperOrchestra stores researcher-recorded quotations and assessments. It does not automatically claim that a source supports a statement, and it does not fabricate page numbers, citations or verification.</p>
    </> : <>
      <div className="re-protocol-overview">
        <Card><div className="re-progress-heading"><span>Protocol completeness</span><strong>{readiness.completionPercent}%</strong></div><Progress value={readiness.completionPercent} aria-label="Protocol completeness"/><small>{readiness.completed.length} of 7 core decisions recorded</small></Card>
        <Card><div className="re-progress-heading"><span>Review status</span><Badge variant={readiness.ready ? "warning" : "secondary"}>{readiness.ready ? "Ready for owner review" : "Draft"}</Badge></div><p>Completeness is not methodological validity, ethics approval or trial registration.</p></Card>
      </div>
      <Card className="re-panel">
        <div className="re-panel-title"><div><h3>Research protocol builder</h3><p>Capture the decisions that make your study reproducible.</p></div><FileCheck2 size={18}/></div>
        <form className="re-form re-protocol-form" onSubmit={saveProtocol}>
          <label>Research question<textarea rows={2} value={protocol.researchQuestion} onChange={event => patchProtocol({ researchQuestion: event.target.value })} required placeholder="What exactly will this study answer?"/></label>
          <div className="re-form-row"><label>Study design<input value={protocol.studyDesign} onChange={event => patchProtocol({ studyDesign: event.target.value })} placeholder="e.g. retrospective cohort" required/></label><label>Setting<input value={protocol.setting} onChange={event => patchProtocol({ setting: event.target.value })} placeholder="Facility, district, country" required/></label></div>
          <div className="re-form-row"><label>Population<input value={protocol.population} onChange={event => patchProtocol({ population: event.target.value })} placeholder="Eligibility and target population" required/></label><label>Planned sample size<input type="number" min="1" value={protocol.sampleSize} onChange={event => patchProtocol({ sampleSize: event.target.value })} placeholder="Number of participants" required/></label></div>
          <label>Primary and secondary outcomes<textarea rows={2} value={protocol.outcomes.join("\n")} onChange={event => patchProtocol({ outcomes: event.target.value.split("\n").map(value => value.trim()).filter(Boolean) })} placeholder="One outcome per line"/></label>
          <label>Analysis plan<textarea rows={4} value={protocol.analysisPlan} onChange={event => patchProtocol({ analysisPlan: event.target.value })} placeholder="Describe variables, comparisons, statistical methods, assumptions and missing-data handling" required/></label>
          <label>Assumptions<textarea rows={2} value={protocol.assumptions.join("\n")} onChange={event => patchProtocol({ assumptions: event.target.value.split("\n").map(value => value.trim()).filter(Boolean) })} placeholder="What assumptions need to be checked?"/></label>
          <label>Limitations<textarea rows={2} value={protocol.limitations.join("\n")} onChange={event => patchProtocol({ limitations: event.target.value.split("\n").map(value => value.trim()).filter(Boolean) })} placeholder="Known constraints or sources of bias"/></label>
          {readiness.missing.length > 0 && <div className="re-missing"><strong>Still needed</strong><ul>{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul></div>}
          <div className="re-protocol-actions"><Button type="submit">Save protocol draft</Button><span>Owner approval remains required before protocol adoption.</span></div>
        </form>
      </Card>
    </>}
  </section>;
}
