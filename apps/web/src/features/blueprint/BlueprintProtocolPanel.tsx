import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardCheck, Save, ShieldCheck } from "lucide-react";
import {
  assessProtocolReadiness,
  createProtocolDraft,
  type ResearchProtocolDraft
} from "../../../../../frontend/src/lib/research-protocol";
import type {
  ResearchBlueprint,
  ResearchEntity,
  ResearchPaperType
} from "../../../../../frontend/src/lib/research-blueprint";
import type { Project } from "../../../../../frontend/src/lib/types";
import {
  listResearchEntities,
  loadResearchBlueprint,
  recordOwnerResearchDecision,
  saveResearchEntity
} from "../../../../../frontend/src/lib/db";
import { protocolDraftToEntity, protocolEntityToDraft } from "./blueprintProtocolModel.mjs";
import "./blueprint-protocol.css";

const PAPER_TYPES: Array<{ value: ResearchPaperType; label: string }> = [
  { value: "unspecified", label: "Not decided yet" },
  { value: "empirical-study", label: "Empirical study" },
  { value: "systematic-review", label: "Systematic review" },
  { value: "scoping-review", label: "Scoping review" },
  { value: "case-report", label: "Case report" },
  { value: "conference-paper", label: "Conference paper" },
  { value: "research-protocol", label: "Research protocol" },
  { value: "dataset-analysis", label: "Dataset analysis" },
  { value: "existing-manuscript", label: "Improve an existing manuscript" },
  { value: "other", label: "Other research output" }
];

function lines(values: string[] | undefined) {
  return (values ?? []).join("\n");
}

function parseLines(value: string) {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

export default function BlueprintProtocolPanel({ project, onPatchProject, onSaveProject }: { project: Project; onPatchProject: (changes: Partial<Project>) => void; onSaveProject: () => Promise<void> }) {
  const projectId = project.id;
  const [blueprintVersion, setBlueprintVersion] = useState(0);
  const [protocol, setProtocol] = useState<ResearchProtocolDraft | null>(null);
  const [protocolEntity, setProtocolEntity] = useState<ResearchEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalRationale, setApprovalRationale] = useState("");

  const readiness = useMemo(
    () => protocol ? assessProtocolReadiness(protocol) : null,
    [protocol]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([loadResearchBlueprint(projectId), listResearchEntities(projectId)])
      .then(([savedBlueprint, entities]) => {
        if (!active) return;
        if (!savedBlueprint) throw new Error("The project is no longer available in the local research library.");
        const savedEntity = entities.find(entity => entity.entityType === "research-protocol") ?? null;
        const savedProtocol = protocolEntityToDraft(savedEntity) ?? createProtocolDraft({
          projectId,
          researchQuestion: savedBlueprint.researchQuestion
        });
        setBlueprintVersion(savedBlueprint.version);
        setProtocol(savedProtocol);
        setProtocolEntity(savedEntity);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "The Research Blueprint could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [projectId]);

  const updateBlueprint = (changes: Partial<ResearchBlueprint>) => {
    const projectChanges: Partial<Project> = {};
    if (changes.title !== undefined) projectChanges.name = changes.title;
    if (changes.description !== undefined) projectChanges.notes = changes.description;
    if (changes.researchQuestion !== undefined) projectChanges.researchQuestion = changes.researchQuestion;
    if (changes.objectives !== undefined) projectChanges.objectives = changes.objectives;
    if (changes.paperType !== undefined) projectChanges.paperType = changes.paperType;
    if (changes.intendedAudience !== undefined) projectChanges.intendedAudience = changes.intendedAudience;
    if (changes.availableMaterials !== undefined) projectChanges.availableMaterials = changes.availableMaterials;
    if (changes.storyArc !== undefined) projectChanges.storyArc = changes.storyArc;
    if (changes.researchMode !== undefined) projectChanges.researchMode = changes.researchMode;
    onPatchProject(projectChanges);
    setNotice("");
  };

  const updateProtocol = (changes: Partial<ResearchProtocolDraft>) => {
    setProtocol(current => current ? {
      ...current,
      ...changes,
      status: current.status === "approved" ? "amended" : current.status
    } : current);
    setNotice("");
  };

  const saveBlueprint = async () => {
    if (!blueprint) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onSaveProject();
      const saved = await loadResearchBlueprint(projectId);
      if (!saved) throw new Error("The Research Blueprint could not be saved.");
      setBlueprintVersion(saved.version);
      setNotice("Research Blueprint saved locally.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Research Blueprint could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveProtocol = async (nextStatus?: ResearchProtocolDraft["status"]) => {
    if (!protocol) return null;
    const now = Date.now();
    const nextDraft = {
      ...protocol,
      status: nextStatus ?? protocol.status,
      updatedAt: now
    };
    const entity = protocolDraftToEntity(nextDraft, protocolEntity ?? undefined, now);
    await saveResearchEntity(entity);
    setProtocolEntity(entity);
    setProtocol(nextDraft);
    return entity;
  };

  const saveProtocolDraft = async (status?: ResearchProtocolDraft["status"]) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveProtocol(status);
      setNotice(status === "ready-for-owner-review"
        ? "Protocol submitted for your review. It is not approved yet."
        : "Protocol draft saved locally.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The protocol could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const approveProtocol = async () => {
    if (!protocol) return;
    if (!window.confirm("As the project owner, do you approve this protocol draft? This records your decision and does not replace ethics review or institutional approval.")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const entity = await saveProtocol("approved");
      if (!entity) throw new Error("The protocol could not be saved.");
      const now = Date.now();
      await recordOwnerResearchDecision({
        id: "decision:" + projectId + ":protocol:" + now,
        projectId,
        subjectType: "research-protocol",
        subjectId: entity.id,
        decision: "approved",
        rationale: approvalRationale.trim(),
        proposedBy: "owner",
        approvedByOwner: false,
        decidedByOwner: true,
        createdAt: now,
        updatedAt: now
      }, true);
      setNotice("Your owner approval has been recorded. Institutional and ethics approvals remain separate.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The owner decision could not be recorded.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="blueprint-state" role="status">Loading your Research Blueprint…</div>;
  if (error && !blueprint) return <div className="blueprint-state blueprint-error" role="alert"><AlertCircle size={17} />{error}</div>;
  if (!protocol || !readiness) return null;

  return (
    <section className="blueprint-panel" aria-label="Research Blueprint and protocol">
      <div className="blueprint-section-heading">
        <div>
          <p className="eyebrow">RESEARCH BLUEPRINT</p>
          <h2>Define the research before the work begins</h2>
          <p>Keep the research question, intended contribution and working plan connected to this project.</p>
        </div>
        <span className="blueprint-version">Blueprint v{blueprintVersion}</span>
      </div>

      {error && <div className="blueprint-alert" role="alert"><AlertCircle size={16} />{error}</div>}
      {notice && <div className="blueprint-notice" role="status"><CheckCircle2 size={16} />{notice}</div>}

      <div className="blueprint-form-grid">
        <label className="blueprint-field blueprint-field-wide">
          <span>Research title</span>
          <input value={project.name} maxLength={180} onChange={event => updateBlueprint({ title: event.target.value })} />
        </label>
        <label className="blueprint-field blueprint-field-wide">
          <span>Problem or observation</span>
          <textarea rows={3} value={project.notes ?? ""} onChange={event => updateBlueprint({ description: event.target.value })} placeholder="Describe the problem, observation or knowledge gap that motivates this work." />
        </label>
        <label className="blueprint-field blueprint-field-wide">
          <span>Research question</span>
          <textarea rows={3} value={project.researchQuestion ?? ""} onChange={event => updateBlueprint({ researchQuestion: event.target.value })} placeholder="What specific question should the research answer?" />
        </label>
        <label className="blueprint-field">
          <span>Research output</span>
          <select value={project.paperType ?? "unspecified"} onChange={event => updateBlueprint({ paperType: event.target.value as ResearchPaperType })}>
            {PAPER_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="blueprint-field">
          <span>Intended audience</span>
          <input value={project.intendedAudience ?? ""} onChange={event => updateBlueprint({ intendedAudience: event.target.value })} placeholder="Who will use or benefit from the findings?" />
        </label>
        <label className="blueprint-field">
          <span>Objectives (one per line)</span>
          <textarea rows={4} value={lines(project.objectives)} onChange={event => updateBlueprint({ objectives: parseLines(event.target.value) })} placeholder="Describe the outcomes this project should achieve." />
        </label>
        <label className="blueprint-field">
          <span>Available materials (one per line)</span>
          <textarea rows={4} value={lines(project.availableMaterials)} onChange={event => updateBlueprint({ availableMaterials: parseLines(event.target.value) })} placeholder="Datasets, protocols, documents, equipment or other materials." />
        </label>
        <label className="blueprint-field blueprint-field-wide">
          <span>Research story arc (one step per line)</span>
          <textarea rows={4} value={lines(project.storyArc)} onChange={event => updateBlueprint({ storyArc: parseLines(event.target.value) })} placeholder="Context, knowledge gap, question, contribution and intended impact." />
        </label>
      </div>
      <div className="blueprint-actions">
        <span>Researcher-owned changes · Stored on this device</span>
        <button type="button" className="blueprint-button" onClick={() => void saveBlueprint()} disabled={saving}>
          <Save size={15} />{saving ? "Saving…" : "Save blueprint"}
        </button>
      </div>

      <div className="protocol-divider" />
      <div className="blueprint-section-heading protocol-heading">
        <div>
          <p className="eyebrow">PROTOCOL BUILDER</p>
          <h2>Turn the question into a study plan</h2>
          <p>Assess completeness, then explicitly submit and approve the draft when it is ready for owner review.</p>
        </div>
        <span className={"protocol-status status-" + protocol.status}>{protocol.status.replaceAll("-", " ")}</span>
      </div>

      <div className="protocol-readiness">
        <div className="protocol-progress-copy">
          <strong>{readiness.completionPercent}% complete</strong>
          <span>{readiness.completed.length} of 7 planning checks complete</span>
        </div>
        <div className="protocol-progress-track" role="progressbar" aria-label="Protocol completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.completionPercent}>
          <span style={{ width: readiness.completionPercent + "%" }} />
        </div>
        {readiness.missing.length > 0 && <p className="protocol-missing">Still needed: {readiness.missing.join(", ")}</p>}
        {readiness.ready && <p className="protocol-ready"><CheckCircle2 size={15} /> All planning fields are complete. This does not validate scientific quality or grant ethics approval.</p>}
      </div>

      <div className="blueprint-form-grid">
        <label className="blueprint-field blueprint-field-wide">
          <span>Study design</span>
          <input value={protocol.studyDesign} onChange={event => updateProtocol({ studyDesign: event.target.value })} placeholder="e.g. Retrospective cohort study" />
        </label>
        <label className="blueprint-field">
          <span>Study setting</span>
          <input value={protocol.setting} onChange={event => updateProtocol({ setting: event.target.value })} placeholder="Country, institution or care setting" />
        </label>
        <label className="blueprint-field">
          <span>Target population</span>
          <input value={protocol.population} onChange={event => updateProtocol({ population: event.target.value })} placeholder="Who or what will be studied?" />
        </label>
        <label className="blueprint-field">
          <span>Sample size</span>
          <input inputMode="numeric" value={protocol.sampleSize} onChange={event => updateProtocol({ sampleSize: event.target.value })} placeholder="Positive number" />
        </label>
        <label className="blueprint-field">
          <span>Outcomes (one per line)</span>
          <textarea rows={3} value={lines(protocol.outcomes)} onChange={event => updateProtocol({ outcomes: parseLines(event.target.value) })} placeholder="Primary and secondary outcomes." />
        </label>
        <label className="blueprint-field blueprint-field-wide">
          <span>Analysis plan</span>
          <textarea rows={3} value={protocol.analysisPlan} onChange={event => updateProtocol({ analysisPlan: event.target.value })} placeholder="Describe the planned analysis and how it addresses the research question." />
        </label>
        <label className="blueprint-field">
          <span>Assumptions (one per line)</span>
          <textarea rows={3} value={lines(protocol.assumptions)} onChange={event => updateProtocol({ assumptions: parseLines(event.target.value) })} />
        </label>
        <label className="blueprint-field">
          <span>Limitations (one per line)</span>
          <textarea rows={3} value={lines(protocol.limitations)} onChange={event => updateProtocol({ limitations: parseLines(event.target.value) })} />
        </label>
      </div>

      <label className="blueprint-field approval-rationale">
        <span>Owner decision rationale (optional)</span>
        <textarea rows={2} value={approvalRationale} onChange={event => setApprovalRationale(event.target.value)} placeholder="Record why you approve this protocol." />
      </label>
      <div className="protocol-actions">
        <button type="button" className="blueprint-button secondary" onClick={() => void saveProtocolDraft()} disabled={saving}>
          <Save size={15} />Save protocol draft
        </button>
        <button type="button" className="blueprint-button secondary" onClick={() => void saveProtocolDraft("ready-for-owner-review")} disabled={saving || !readiness.ready}>
          <ClipboardCheck size={15} />Submit for owner review
        </button>
        <button type="button" className="blueprint-button" onClick={() => void approveProtocol()} disabled={saving || !readiness.ready || protocol.status !== "ready-for-owner-review"}>
          <ShieldCheck size={15} />Approve as project owner
        </button>
      </div>
      <p className="protocol-disclaimer">Owner approval records your project decision only. Ethics committee, institutional, regulatory and funder approvals remain separate.</p>
    </section>
  );
}
