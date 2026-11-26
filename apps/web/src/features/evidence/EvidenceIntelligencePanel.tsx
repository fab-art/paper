import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, ClipboardList, FileText, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import type { Paper, ResearchRelation } from "../../../../../frontend/src/lib/types";
import type { ResearchEntity } from "../../../../../frontend/src/lib/research-blueprint";
import {
  assessClaimEvidence,
  createClaimRecord,
  createEvidencePassage,
  type EvidenceJudgement
} from "../../../../../frontend/src/lib/evidence-intelligence";
import { listResearchEntities, listResearchRelations, saveResearchEntity, saveResearchRelation } from "../../../../../frontend/src/lib/db";
import "./evidence-intelligence.css";

const judgementLabels: Record<EvidenceJudgement, string> = {
  supports: "Supports",
  "partially-supports": "Partially supports",
  contradicts: "Contradicts",
  irrelevant: "Not relevant"
};
const statusLabels: Record<string, string> = {
  "awaiting-verification": "Awaiting verification",
  supported: "Supported",
  "partially-supported": "Partially supported",
  unsupported: "Unsupported",
  "conflicting-evidence": "Conflicting evidence"
};
const uid = (prefix: string) => prefix + ":" + crypto.randomUUID();

function paperKey(paper: Paper) {
  return String(paper.doi || paper.url || paper.title).trim().toLocaleLowerCase();
}

export default function EvidenceIntelligencePanel({ projectId, papers }: { projectId: string; papers: Paper[] }) {
  const [entities, setEntities] = useState<ResearchEntity[]>([]);
  const [relations, setRelations] = useState<ResearchRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [claimText, setClaimText] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [quote, setQuote] = useState("");
  const [locator, setLocator] = useState("");
  const [judgement, setJudgement] = useState<EvidenceJudgement>("supports");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextEntities, nextRelations] = await Promise.all([
        listResearchEntities(projectId),
        listResearchRelations(projectId)
      ]);
      setEntities(nextEntities);
      setRelations(nextRelations);
      setSelectedClaimId(current => current || nextEntities.find(entity => entity.entityType === "claim")?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The evidence workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [projectId]);

  const sources = useMemo(() => {
    const existing = entities.filter(entity => entity.entityType === "source");
    const sourceKeys = new Set(existing.map(entity => paperKey(entity.payload as Paper)));
    const imported = papers.filter(paper => !sourceKeys.has(paperKey(paper))).map((paper) => {
      const now = Date.now();
      return {
        id: "project-paper:" + encodeURIComponent(paperKey(paper)),
        projectId,
        entityType: "source" as const,
        version: 1,
        status: "draft" as const,
        title: paper.title,
        payload: { ...paper },
        provenance: { kind: "owner" as const, sourceLabel: "Project library reference", recordedAt: now },
        createdAt: now,
        updatedAt: now
      };
    });
    return [...existing, ...imported];
  }, [entities, papers, projectId]);

  const claims = entities.filter(entity => entity.entityType === "claim");
  const passages = entities.filter(entity => entity.entityType === "research-note" && entity.payload.recordType === "evidence-passage");
  const selectedClaim = claims.find(claim => claim.id === selectedClaimId);

  const assessmentFor = (claim: ResearchEntity) => {
    const linked = relations
      .filter(relation => relation.toEntityId === claim.id && relation.relationType === "supports")
      .map(relation => passages.find(passage => passage.id === relation.fromEntityId))
      .filter((item): item is ResearchEntity => Boolean(item));
    return assessClaimEvidence(claim, linked.map(item => ({
      id: item.id,
      judgement: item.payload.judgement as EvidenceJudgement
    })));
  };

  const evidenceFor = (claimId: string) => relations
    .filter(relation => relation.toEntityId === claimId && relation.relationType === "supports")
    .map(relation => passages.find(passage => passage.id === relation.fromEntityId))
    .filter((item): item is ResearchEntity => Boolean(item));

  const addClaim = async (event: FormEvent) => {
    event.preventDefault();
    if (!claimText.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const claim = createClaimRecord({ id: uid("claim"), projectId, text: claimText });
      await saveResearchEntity(claim);
      setClaimText("");
      setSelectedClaimId(claim.id);
      await refresh();
      setNotice("Claim saved as awaiting verification. Add source-level evidence before relying on it.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The claim could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const addEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClaimId || !sourceId) {
      setError("Select both a claim and a source record.");
      return;
    }
    if (!quote.trim()) {
      setError("Paste the exact passage from the source before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const source = sources.find(item => item.id === sourceId);
      if (!source) throw new Error("The selected source is no longer available.");
      if (!entities.some(entity => entity.id === source.id)) await saveResearchEntity(source);
      const passage = createEvidencePassage({
        id: uid("passage"),
        projectId,
        sourceEntityId: source.id,
        quote,
        locator
      });
      passage.payload.judgement = judgement;
      await saveResearchEntity(passage);
      const relation: ResearchRelation = {
        id: uid("relation"),
        projectId,
        fromEntityId: passage.id,
        toEntityId: selectedClaimId,
        relationType: "supports",
        provenance: {
          kind: "owner",
          sourceId: source.id,
          sourceLabel: "Researcher-assessed evidence link",
          recordedAt: Date.now()
        },
        createdAt: Date.now()
      };
      await saveResearchRelation(relation);
      setQuote("");
      setLocator("");
      await refresh();
      setNotice("Source passage and researcher judgement saved. Review the evidence status and original publication.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The evidence passage could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="evidence-intelligence" aria-labelledby="evidence-intelligence-title" aria-busy={loading}>
      <div className="evidence-intro">
        <div>
          <p className="eyebrow"><BookOpenCheck size={13} /> EVIDENCE INTELLIGENCE</p>
          <h2 id="evidence-intelligence-title">Build research you can defend.</h2>
          <p>Connect each research claim to an inspectable passage from a source. Judgements are entered by you, not generated automatically.</p>
        </div>
        <div className="evidence-source-count"><FileText size={18} /><span>{sources.length} sources in scope</span></div>
      </div>

      {error && <div className="evidence-alert" role="alert"><AlertTriangle size={15} />{error}</div>}
      {notice && <div className="evidence-notice" role="status"><CheckCircle2 size={15} />{notice}</div>}

      <div className="evidence-layout">
        <div className="evidence-claims">
          <div className="evidence-panel-heading"><div><p className="eyebrow">CLAIM REGISTER</p><h3>Research claims</h3></div><button type="button" className="evidence-icon-button" onClick={() => void refresh()} aria-label="Refresh evidence workspace" disabled={loading}><RefreshCw size={14} /></button></div>
          <form className="evidence-claim-form" onSubmit={addClaim}>
            <label className="evidence-field"><span>New claim or statement</span><textarea rows={3} value={claimText} onChange={event => setClaimText(event.target.value)} placeholder="Enter a specific, verifiable research claim…" /></label>
            <button type="submit" className="evidence-button" disabled={saving || !claimText.trim()}><Plus size={14} /> Add claim</button>
          </form>
          {loading ? <div className="evidence-empty" role="status">Loading claims and evidence…</div> :
            claims.length === 0 ? <div className="evidence-empty"><ClipboardList size={21} /><strong>No claims yet</strong><span>Add a claim, then link it to source passages.</span></div> :
            <div className="evidence-claim-list">{claims.map(claim => {
              const assessment = assessmentFor(claim);
              const active = claim.id === selectedClaimId;
              return <button type="button" key={claim.id} className={"evidence-claim " + (active ? "is-active" : "")} onClick={() => setSelectedClaimId(claim.id)} aria-pressed={active}>
                <span className="evidence-claim-text">{String(claim.payload.text ?? claim.title)}</span>
                <span className={"evidence-status status-" + assessment.status}>{statusLabels[assessment.status]}</span>
                <span className="evidence-count">{assessment.supportingCount + assessment.partialCount + assessment.contradictingCount + assessment.irrelevantCount} linked passages</span>
              </button>;
            })}</div>
          }
        </div>

        <div className="evidence-detail">
          {!selectedClaim ? <div className="evidence-empty evidence-detail-empty"><ClipboardList size={24} /><strong>Select a claim</strong><span>Choose a claim to inspect its linked source passages and evidence judgements.</span></div> : <>
            <div className="evidence-panel-heading"><div><p className="eyebrow">CLAIM ASSESSMENT</p><h3>{String(selectedClaim.payload.text ?? selectedClaim.title)}</h3></div><span className={"evidence-status status-" + assessmentFor(selectedClaim).status}>{statusLabels[assessmentFor(selectedClaim).status]}</span></div>
            <div className="evidence-count-grid">
              <div><strong>{assessmentFor(selectedClaim).supportingCount}</strong><span>Supports</span></div>
              <div><strong>{assessmentFor(selectedClaim).partialCount}</strong><span>Partial</span></div>
              <div><strong>{assessmentFor(selectedClaim).contradictingCount}</strong><span>Contradicts</span></div>
              <div><strong>{assessmentFor(selectedClaim).irrelevantCount}</strong><span>Not relevant</span></div>
            </div>
            {assessmentFor(selectedClaim).status === "conflicting-evidence" && <div className="evidence-conflict"><ShieldAlert size={16} /><span>Contradictory evidence is present. Do not collapse this disagreement into a single positive conclusion.</span></div>}

            <div className="evidence-passage-list">
              <div className="evidence-passage-heading"><h4>Linked source passages</h4><span>{evidenceFor(selectedClaim.id).length}</span></div>
              {evidenceFor(selectedClaim.id).length === 0 ? <p className="evidence-muted">No source passages have been linked to this claim yet.</p> : evidenceFor(selectedClaim.id).map(passage => {
                const source = sources.find(item => item.id === passage.payload.sourceEntityId);
                const rating = passage.payload.judgement as EvidenceJudgement;
                return <article className="evidence-passage" key={passage.id}>
                  <p>“{String(passage.payload.quote ?? "")}”</p>
                  <div><strong>{source?.title ?? "Source record"}</strong><span>{String(passage.payload.locator || "Locator not recorded")}</span><span className={"evidence-judgement judgement-" + rating}>{judgementLabels[rating]}</span></div>
                </article>;
              })}
            </div>

            <form className="evidence-add-form" onSubmit={addEvidence}>
              <div className="evidence-panel-heading"><div><p className="eyebrow">SOURCE-LEVEL EVIDENCE</p><h4>Add a passage</h4></div></div>
              <label className="evidence-field"><span>Source record</span><select value={sourceId} onChange={event => setSourceId(event.target.value)} required>
                <option value="">Select a paper or source</option>
                {sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}
              </select></label>
              <label className="evidence-field"><span>Exact source passage</span><textarea rows={4} value={quote} onChange={event => setQuote(event.target.value)} required placeholder="Transcribe the exact sentence or passage that relates to this claim." /></label>
              <div className="evidence-form-row">
                <label className="evidence-field"><span>Page, table or section</span><input value={locator} onChange={event => setLocator(event.target.value)} placeholder="e.g. p. 8, Table 2" /></label>
                <label className="evidence-field"><span>Your judgement</span><select value={judgement} onChange={event => setJudgement(event.target.value as EvidenceJudgement)}>
                  <option value="supports">Supports</option>
                  <option value="partially-supports">Partially supports</option>
                  <option value="contradicts">Contradicts</option>
                  <option value="irrelevant">Not relevant</option>
                </select></label>
              </div>
              <button type="submit" className="evidence-button" disabled={saving || !sourceId || !quote.trim()}><Plus size={14} /> Save evidence passage</button>
            </form>
          </>}
        </div>
      </div>
      <p className="evidence-disclaimer">Evidence status summarizes researcher-entered passage judgements only. It is not an automated risk-of-bias assessment, GRADE certainty rating or substitute for critical appraisal of the full study.</p>
    </section>
  );
}
