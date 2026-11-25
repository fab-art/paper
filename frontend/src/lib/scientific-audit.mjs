const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const text = value => typeof value === "string" ? value.trim() : "";
const idFor = (category, targetId, suffix = "") =>
  ["phase9", category, targetId || "project", suffix].filter(Boolean).join(":");

function finding(category, severity, title, description, targetType, targetId, evidence, recommendation, location = "") {
  const id = idFor(category, targetId, location);
  return {
    id, category, severity, title, description, targetType, targetId: targetId || "",
    evidence: text(evidence), recommendation: text(recommendation), location: text(location),
    status: "open"
  };
}

function parseCitationKeys(latex) {
  const keys = new Set();
  const command = /\\(?:cite|citep|citet|citeauthor|citeyear|autocite|parencite|textcite|footcite)(?:\[[^\]]*\]){0,2}\s*\{([^}]*)\}/g;
  for (const match of String(latex || "").matchAll(command)) {
    for (const key of match[1].split(",")) if (key.trim()) keys.add(key.trim());
  }
  return [...keys].sort();
}

function parseBibtexKeys(bibtex) {
  const keys = new Set();
  const pattern = /@\w+\s*\{\s*([^,\s]+)\s*,/g;
  for (const match of String(bibtex || "").matchAll(pattern)) keys.add(match[1].trim());
  return [...keys].sort();
}

function getPassageEvidence(claim, entities, relations) {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  return relations
    .filter(relation => relation.toEntityId === claim.id && relation.relationType === "supports")
    .map(relation => byId.get(relation.fromEntityId))
    .filter(entity => entity?.entityType === "research-note" && entity.payload?.recordType === "evidence-passage")
    .filter(entity => text(entity.payload?.quote) && text(entity.payload?.sourceEntityId) && byId.get(entity.payload.sourceEntityId)?.entityType === "source");
}

export function runScientificAudit({ project, entities = [], relations = [], now = Date.now() }) {
  if (!project?.id) throw new Error("A saved project is required to run a scientific audit.");
  const findings = [];
  const projectEntities = entities.filter(entity => entity.projectId === project.id);
  const projectRelations = relations.filter(relation => relation.projectId === project.id);
  const entityById = new Map(projectEntities.map(entity => [entity.id, entity]));

  for (const claim of projectEntities.filter(entity => entity.entityType === "claim")) {
    const passages = getPassageEvidence(claim, projectEntities, projectRelations);
    const judgements = passages.map(passage => text(passage.payload?.judgement) || "unassessed");
    const contradicting = judgements.filter(value => value === "contradicts").length;
    const supporting = judgements.filter(value => value === "supports").length;
    const partial = judgements.filter(value => value === "partially-supports").length;
    if (contradicting) {
      findings.push(finding(
        "claim-evidence", "critical", "Conflicting evidence is linked to this claim",
        "At least one linked source passage has been assessed as contradicting the claim. The audit does not resolve the scientific disagreement.",
        "claim", claim.id, `${contradicting} contradicting passage(s); ${supporting} supporting; ${partial} partially supporting.`,
        "Inspect the original sources, reassess the passage links and revise or qualify the claim with an owner-recorded rationale."
      ));
    } else if (!supporting && !partial) {
      findings.push(finding(
        "claim-evidence", "high", "Claim has no assessed supporting evidence",
        "No source-linked passage assessed as supporting or partially supporting this claim was found.",
        "claim", claim.id, `${passages.length} usable linked passage(s); none assessed as support.`,
        "Attach exact source passages with locators and record a researcher assessment, or mark the claim as awaiting evidence."
      ));
    } else if (judgements.some(value => value === "unassessed")) {
      findings.push(finding(
        "claim-evidence", "medium", "Some linked passages remain unassessed",
        "The claim has source-linked passages, but at least one has no recorded researcher assessment.",
        "claim", claim.id, `${judgements.filter(value => value === "unassessed").length} unassessed passage(s).`,
        "Review each passage and record whether it supports, partially supports, contradicts or is irrelevant to the claim."
      ));
    }
  }

  const citedKeys = parseCitationKeys(project.latex);
  const bibKeys = new Set(parseBibtexKeys(project.bibtex));
  const missingKeys = citedKeys.filter(key => !bibKeys.has(key));
  if (missingKeys.length) {
    findings.push(finding(
      "citation-integrity", "high", "Manuscript citations are missing from the bibliography",
      "One or more citation keys used in the manuscript do not have matching BibTeX entries.",
      "project", project.id, `Missing keys: ${missingKeys.join(", ")}.`,
      "Add or correct the corresponding bibliography records and verify each reference against its original source.",
      "LaTeX bibliography"
    ));
  }

  for (const analysis of projectEntities.filter(entity => entity.entityType === "analysis")) {
    if (analysis.status !== "approved" && analysis.status !== "verified") {
      findings.push(finding(
        "analysis-approval", analysis.status === "stale" ? "high" : "medium",
        analysis.status === "stale" ? "Analysis output is stale" : "Analysis output is not owner-approved",
        "This output must not be presented as a verified result until its reproducibility record and interpretation have been reviewed.",
        "analysis", analysis.id, `Current lifecycle status: ${analysis.status}.`,
        "Inspect the dataset fingerprint, transformations, parameters, script, runtime and outputs; then record an explicit owner review decision."
      ));
    }
  }

  const sources = projectEntities.filter(entity => entity.entityType === "source");
  for (const source of sources) {
    const doi = text(source.payload?.doi);
    const url = text(source.payload?.url);
    if (!doi && !url) {
      findings.push(finding(
        "source-traceability", "medium", "Source has no DOI or URL",
        "The reference record has no persistent identifier or source URL recorded.",
        "source", source.id, source.title,
        "Add a DOI or stable source URL and verify the bibliographic metadata against the publisher or repository."
      ));
    }
  }

  const researchQuestion = text(project.researchQuestion);
  const methodology = text(project.methodology);
  const objectives = Array.isArray(project.objectives) ? project.objectives.filter(item => text(item)) : [];
  if (!researchQuestion) findings.push(finding(
    "research-completeness", "medium", "Research question is not recorded",
    "The project brief has no research question for reviewers to assess.",
    "project", project.id, "Research question field is empty.",
    "Record the owner-approved research question before assessing alignment between aims, methods and conclusions."
  ));
  if (!methodology) findings.push(finding(
    "research-completeness", "medium", "Methodology is not recorded",
    "The project brief has no methodology description.",
    "project", project.id, "Methodology field is empty.",
    "Document the study design, setting, population, data sources and planned analysis; obtain owner review."
  ));
  if (!objectives.length) findings.push(finding(
    "research-completeness", "low", "Research objectives are not recorded",
    "No project objectives are available for a consistency inspection.",
    "project", project.id, "No objectives recorded.",
    "Add measurable objectives and check that each is addressed by the methods and reported results."
  ));

  // Guard against dangling relationships in the canonical project graph.
  for (const relation of projectRelations) {
    if (!entityById.has(relation.fromEntityId) || !entityById.has(relation.toEntityId)) {
      findings.push(finding(
        "provenance-integrity", "high", "Research relationship points to a missing record",
        "A saved relationship references an entity that is not present in this project's current research graph.",
        "relation", relation.id, `${relation.fromEntityId} → ${relation.toEntityId}`,
        "Restore or correct the missing entity relationship. Do not infer or recreate the missing evidence automatically."
      ));
    }
  }

  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  const fixCards = findings.map((item, index) => ({
    id: `fix:${item.id}`, findingId: item.id, priority: index + 1,
    severity: item.severity, title: item.title, targetType: item.targetType,
    targetId: item.targetId, location: item.location,
    action: item.recommendation, status: "open"
  }));

  return {
    id: `audit:${project.id}:${now}`, projectId: project.id, generatedAt: now,
    engine: "PaperOrchestra Scientific Audit 1.0",
    label: "Deterministic research-quality inspection",
    findings, fixCards,
    summary: {
      total: findings.length,
      critical: findings.filter(item => item.severity === "critical").length,
      high: findings.filter(item => item.severity === "high").length,
      medium: findings.filter(item => item.severity === "medium").length,
      low: findings.filter(item => item.severity === "low").length
    },
    scope: {
      claimEvidence: "researcher-assessed links; not independent scientific verification",
      citations: "citation-key and bibliography-record consistency only; source validity not established",
      analyses: "approval-state inspection only; statistical validity is not certified",
      reviewer: "AI-assisted checklist prompts are a simulation, not real peer review",
      journal: "fit advice requires current, sourced journal metadata"
    }
  };
}

function words(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
}

export function assessJournalFit({ manuscript = {}, journal = {} } = {}) {
  const scope = text(journal.aimsAndScope);
  const keywords = [...new Set((manuscript.keywords || []).flatMap(words))];
  const journalWords = new Set(words(scope));
  const overlap = keywords.filter(keyword => journalWords.has(keyword));
  const articleTypes = Array.isArray(journal.acceptedArticleTypes) ? journal.acceptedArticleTypes : [];
  const typeMatch = Boolean(manuscript.paperType && articleTypes.includes(manuscript.paperType));
  const enoughData = Boolean(scope && keywords.length && articleTypes.length);
  const score = enoughData ? Math.round((overlap.length / Math.max(1, keywords.length) * 0.7 + (typeMatch ? 0.3 : 0)) * 100) : null;
  const sourceUrl = text(journal.sourceUrl);
  const researcherMarkedSource = /^https:\/\//i.test(sourceUrl) && Number.isFinite(journal.verifiedAt) && journal.verifiedAt > 0;
  return {
    status: !enoughData ? "insufficient-data" : researcherMarkedSource ? "scope-overlap-calculated" : "needs-source-verification",
    journalTitle: text(journal.title),
    scopeOverlap: overlap,
    scopeFitScore: score,
    articleTypeMatch: enoughData ? typeMatch : null,
    sourceUrl: sourceUrl || null,
    verifiedAt: researcherMarkedSource ? journal.verifiedAt : null,
    metadataStatus: researcherMarkedSource ? "researcher-marked-source-and-date" : "unverified",
    apc: journal.apc ?? null,
    reviewTimeline: journal.reviewTimeline ?? null,
    indexing: Array.isArray(journal.indexing) ? journal.indexing : [],
    acceptanceProbability: null,
    warning: "This is a preliminary scope comparison, not an acceptance prediction or endorsement. Verify indexing, publisher, fees and timelines directly with the journal."
  };
}

export function simulateReviewerPerspectives({ project, auditReport } = {}) {
  const findings = Array.isArray(auditReport?.findings) ? auditReport.findings : [];
  const dimensions = [
    { id: "contribution", title: "Contribution and relevance", prompt: "Is the research problem important, clearly scoped and supported by a defensible rationale?" },
    { id: "methods", title: "Methods and design", prompt: "Are the design, sampling, measures, data handling and analysis appropriate and sufficiently described?" },
    { id: "evidence", title: "Evidence and citations", prompt: "Are substantive claims traceable to relevant primary evidence, and are limitations and conflicting findings addressed?" },
    { id: "results", title: "Results and interpretation", prompt: "Do the reported results follow from the available data and analysis, without overstated causal or clinical conclusions?" },
    { id: "reporting", title: "Reporting and reproducibility", prompt: "Are reporting details, ethics declarations, data provenance and reproducibility materials sufficiently transparent?" }
  ];
  return {
    kind: "simulation", isPeerReview: false, projectId: project?.id || "",
    label: "Simulated reviewer checklist — not a real peer review",
    perspectives: dimensions.map(item => ({
      ...item, status: "prompt-only",
      relatedFindingIds: findings.filter(finding => {
        const category = finding.category || "";
        return item.id === "methods" ? category === "research-completeness" :
          item.id === "evidence" ? category === "claim-evidence" || category === "citation-integrity" :
          item.id === "reporting" ? category === "provenance-integrity" || category === "source-traceability" :
          item.id === "results" ? category === "analysis-approval" : false;
      }).map(finding => finding.id)
    }))
  };
}
