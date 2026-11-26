const AUDIT_STATUSES = new Set(["not-reviewed", "verified", "needs-attention", "not-applicable"]);
const PUBLICATION_STATUSES = new Set(["draft", "ready", "submitted", "revision", "accepted", "published"]);
const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
function finding(id, category, title, description, severity = "medium", source = "") {
  return { id, category, title, description, severity, source, status: "not-reviewed", reviewer: "", note: "", reviewedAt: null };
}
export function createScientificAudit(project, { blueprint = null, attachments = [], now = Date.now() } = {}) {
  if (!project?.id) throw new Error("A project is required to create a scientific audit.");
  const papers = Array.isArray(project.papers) ? project.papers : [];
  const review = project.systematicReview;
  const screening = Object.values(review?.screening ?? {});
  const included = screening.filter(item => item?.fullTextDecision === "include");
  const extracted = Object.keys(review?.extraction ?? {}).length;
  const domains = Object.values(review?.riskOfBias ?? {}).flatMap(record => record?.domains ?? []);
  const findings = [
    finding("protocol-question", "protocol", "Research question and objectives", "Confirm that the research question and objectives are explicit, aligned and approved by the responsible researcher.", "high", "Project research question and objectives"),
    finding("protocol-methods", "protocol", "Protocol and methods", "Check the approved protocol, design, eligibility criteria, search methods and any deviations.", "high", "Research Blueprint and review protocol"),
    finding("evidence-provenance", "evidence", "Evidence provenance and source records", papers.length ? `${papers.length} paper record(s) are linked. Verify source identity, DOI, publication details and full-text provenance.` : "No paper records are linked to this project. Confirm the evidence base or record why this is not applicable.", "high", "Project paper library"),
    finding("evidence-screening", "evidence", "Study selection traceability", screening.length ? `${screening.length} screening record(s) exist. Verify decisions, reasons and full-text eligibility against the protocol.` : "No screening records are present. Confirm whether study screening is part of this project.", "medium", "Systematic review screening"),
    finding("methods-extraction", "methods", "Data extraction completeness", included.length ? `${included.length} included study record(s) and ${extracted} extraction record(s) are present. Verify all prespecified fields against source texts.` : "Confirm the extraction method and whether study-level extraction applies.", "medium", "Study extraction records"),
    finding("methods-appraisal", "methods", "Risk-of-bias or quality appraisal", domains.length ? `${domains.length} appraisal domain(s) are recorded. Verify the selected tool, rationale and supporting evidence for each judgement.` : "No appraisal domains are recorded. Confirm whether critical appraisal is required for this design.", "medium", "Risk-of-bias records"),
    finding("methods-data", "methods", "Dataset and analysis reproducibility", attachments.length ? `${attachments.length} project attachment(s) are recorded. Verify data provenance, code, transformations and analysis reproducibility.` : "No project attachments are recorded. Confirm the data sources and reproducibility materials.", "medium", "Project attachments and analysis plan"),
    finding("ethics-declarations", "ethics", "Ethics, consent and governance", "Verify ethics approval or a documented reason for exemption, consent requirements, privacy protections and governance. Do not infer approval from missing records.", "high", "Ethics declarations and project records"),
    finding("integrity-conflicts", "integrity", "Funding, conflicts and research integrity", "Verify funding, competing interests, author contributions, data integrity and any required institutional disclosures.", "high", "Manuscript declarations"),
    finding("manuscript-references", "manuscript", "Manuscript and reference traceability", project.latex?.trim() ? "A manuscript draft exists. Verify claims against cited sources, reference completeness, reporting guideline and consistency with the protocol." : "No manuscript draft is attached. Confirm whether manuscript review is in scope.", "medium", "LaTeX manuscript and BibTeX library")
  ];
  return { id: makeId("audit"), projectId: project.id, version: 1, createdAt: now, updatedAt: now, findings,
    history: [{ id: makeId("audit-event"), action: "created", actor: "system", at: now, detail: "Audit checklist generated; all findings require researcher review." }], signoff: null };
}
export function updateAuditFinding(audit, findingId, patch, { now = Date.now() } = {}) {
  if (!audit?.id) throw new Error("A scientific audit is required.");
  const index = audit.findings.findIndex(item => item.id === findingId);
  if (index < 0) throw new Error("Scientific audit finding was not found.");
  if (!AUDIT_STATUSES.has(patch?.status)) throw new Error("Choose a valid scientific audit review status.");
  const reviewer = String(patch.reviewer ?? "").trim();
  if (!reviewer) throw new Error("A named reviewer is required for scientific audit decisions.");
  const previous = audit.findings[index];
  const updated = { ...previous, status: patch.status, reviewer, note: String(patch.note ?? "").trim(), reviewedAt: now };
  const findings = [...audit.findings]; findings[index] = updated;
  return { ...audit, version: (audit.version ?? 1) + 1, updatedAt: now, findings, signoff: null,
    history: [...audit.history, { id: makeId("audit-event"), action: "finding-reviewed", actor: reviewer, at: now, findingId, detail: `${previous.status} → ${updated.status}` }] };
}
export function summarizeScientificAudit(audit) {
  const findings = audit?.findings ?? [];
  return { total: findings.length, reviewed: findings.filter(item => item.status !== "not-reviewed").length,
    verified: findings.filter(item => item.status === "verified").length,
    needsAttention: findings.filter(item => item.status === "needs-attention").length,
    notApplicable: findings.filter(item => item.status === "not-applicable").length,
    unreviewed: findings.filter(item => item.status === "not-reviewed").length, scientificQualityScore: null };
}
export function finalizeScientificAudit(audit, { reviewer, now = Date.now() } = {}) {
  const actor = String(reviewer ?? "").trim();
  if (!actor) throw new Error("A named reviewer is required for audit sign-off.");
  const summary = summarizeScientificAudit(audit);
  if (summary.unreviewed > 0) throw new Error("Scientific audit sign-off is blocked while findings remain unreviewed.");
  return { ...audit, version: (audit.version ?? 1) + 1, updatedAt: now,
    signoff: { reviewer: actor, signedAt: now, findingsReviewed: summary.reviewed, findingsNeedingAttention: summary.needsAttention },
    history: [...audit.history, { id: makeId("audit-event"), action: "signed-off", actor, at: now, detail: "Researcher completed the checklist review." }] };
}
export function createPublicationPlan(project, { now = Date.now() } = {}) {
  if (!project?.id) throw new Error("A project is required to create a publication plan.");
  return { id: makeId("publication"), projectId: project.id, version: 1, status: "draft", targetJournal: "", articleType: "original-research",
    title: project.name ?? "", abstract: "", keywords: [], authors: [], ethicsDeclaration: "", fundingDeclaration: "", conflictOfInterest: "",
    dataAvailability: "", authorContributions: "", coverLetter: "", createdAt: now, updatedAt: now, submittedAt: null,
    history: [{ action: "created", actor: "system", at: now }] };
}
export function updatePublicationPlan(plan, patch, { now = Date.now() } = {}) {
  if (!plan?.id) throw new Error("A publication plan is required.");
  if (plan.status !== "draft" && plan.status !== "revision") throw new Error("Only draft or revision publication plans can be edited.");
  return { ...plan, ...patch, version: (plan.version ?? 1) + 1, updatedAt: now };
}
export function getPublicationReadiness(project, plan) {
  const missing = [];
  if (!String(plan?.targetJournal ?? "").trim()) missing.push("target-journal");
  if (!String(plan?.articleType ?? "").trim()) missing.push("article-type");
  if (!String(plan?.title ?? "").trim()) missing.push("title");
  if (!String(plan?.abstract ?? "").trim()) missing.push("abstract");
  if (!(plan?.keywords ?? []).some(value => String(value).trim())) missing.push("keywords");
  if (!(plan?.authors ?? []).some(author => String(author.name ?? "").trim())) missing.push("authors");
  if (!(plan?.authors ?? []).some(author => author.corresponding && String(author.name ?? "").trim())) missing.push("corresponding-author");
  if (!String(project?.latex ?? "").trim()) missing.push("manuscript");
  if (!String(project?.bibtex ?? "").trim()) missing.push("references");
  if (!String(plan?.ethicsDeclaration ?? "").trim()) missing.push("ethics-declaration");
  if (!String(plan?.fundingDeclaration ?? "").trim()) missing.push("funding-declaration");
  if (!String(plan?.conflictOfInterest ?? "").trim()) missing.push("conflict-of-interest");
  if (!String(plan?.dataAvailability ?? "").trim()) missing.push("data-availability");
  return { ready: missing.length === 0, missing };
}
export function createCoverLetter(plan) {
  if (!String(plan?.targetJournal ?? "").trim() || !String(plan?.title ?? "").trim()) throw new Error("A target journal and manuscript title are required to draft a cover letter.");
  const authors = (plan.authors ?? []).map(author => String(author.name ?? "").trim()).filter(Boolean);
  return [`Dear Editor,`, ` `, `Please consider the manuscript “${plan.title.trim()}” for publication in ${plan.targetJournal.trim()} as a ${String(plan.articleType ?? "manuscript").replaceAll("-", " ")}.`,
    authors.length ? `The listed authors are ${authors.join(", ")}.` : "", ` `, `The manuscript and its declarations are provided for editorial assessment. Please contact the corresponding author listed in the submission metadata for any questions.`,
    ` `, `Sincerely,`, authors[0] || "The authors"].filter(Boolean).join("\n");
}
export function transitionPublicationStatus(project, plan, nextStatus, { actor, now = Date.now(), confirmExternalSubmission = false } = {}) {
  if (!PUBLICATION_STATUSES.has(nextStatus)) throw new Error("Choose a valid publication status.");
  const reviewer = String(actor ?? "").trim();
  if (!reviewer) throw new Error("A named researcher is required for publication status changes.");
  const allowed = { draft: ["ready"], ready: ["draft", "submitted"], submitted: ["revision", "accepted"], revision: ["ready", "submitted"], accepted: ["published"], published: [] };
  if (!(allowed[plan.status] ?? []).includes(nextStatus)) throw new Error(`Cannot move publication from ${plan.status} to ${nextStatus}.`);
  if (nextStatus === "ready") {
    const readiness = getPublicationReadiness(project, plan);
    if (!readiness.ready) throw new Error(`Publication metadata is incomplete: ${readiness.missing.join(", ")}.`);
  }
  if (nextStatus === "submitted" && !confirmExternalSubmission) throw new Error("Explicit submission confirmation is required after submitting through the journal's own system.");
  return { ...plan, status: nextStatus, version: (plan.version ?? 1) + 1, updatedAt: now,
    submittedAt: nextStatus === "submitted" ? now : plan.submittedAt,
    history: [...(plan.history ?? []), { action: `status-${nextStatus}`, actor: reviewer, at: now }] };
}
