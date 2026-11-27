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

function parseBibtexKeyList(bibtex) {
  const pattern = /@\w+\s*\{\s*([^,\s]+)\s*,/g;
  return [...String(bibtex || "").matchAll(pattern)].map(match => match[1].trim());
}

function parseBibtexKeys(bibtex) {
  return [...new Set(parseBibtexKeyList(bibtex))].sort();
}

function normalizeTitle(value) {
  return text(value).toLowerCase().replace(/[{}]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function sectionHeadings(latex) {
  return [...String(latex || "").matchAll(/\\(?:section|subsection)\*?\s*\{([^}]+)\}/gi)].map(match => match[1].toLowerCase().trim());
}

function hasHeading(headings, pattern) {
  return headings.some(heading => pattern.test(heading));
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
  const bibKeyList = parseBibtexKeyList(project.bibtex);
  const duplicateKeys = bibKeyList.filter((key, index) => bibKeyList.indexOf(key) !== index);
  const uncitedKeys = [...new Set(bibKeyList)].filter(key => !citedKeys.includes(key));
  if (duplicateKeys.length) findings.push(finding(
    "citation-integrity", "high", "Duplicate BibTeX citation keys were found",
    "The bibliography contains repeated keys, which can make citations ambiguous or cause compilation problems.",
    "project", project.id, "Duplicate keys: " + [...new Set(duplicateKeys)].join(", ") + ".",
    "Give each bibliography entry a unique key, then check every in-text citation against the corrected bibliography.", "BibTeX bibliography"
  ));
  if (uncitedKeys.length) findings.push(finding(
    "citation-integrity", "low", "Bibliography contains uncited entries",
    "Some bibliography keys are not used by the current manuscript citation commands.",
    "project", project.id, "Uncited keys: " + uncitedKeys.slice(0, 20).join(", ") + ".",
    "Review whether these references belong in the manuscript or should be removed from the bibliography.", "BibTeX bibliography"
  ));
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
    const manifest = analysis.payload?.manifest;
    const isOutput = analysis.payload?.recordType === "analysis-output";
    if (!manifest || !text(manifest.datasetId) || !text(manifest.datasetFingerprint) || !text(manifest.script) || !Object.keys(manifest.software || {}).length || !manifest.parameters || typeof manifest.parameters !== "object") {
      findings.push(finding(
        "reproducibility", "high", "Analysis reproducibility record is incomplete",
        "The analysis record is missing one or more required dataset, fingerprint, procedure, software or parameter fields.",
        "analysis", analysis.id, "Record type: " + (analysis.payload?.recordType || "unspecified") + ".",
        "Record the immutable dataset identity and fingerprint, analysis script or procedure, software/runtime and all parameters before relying on the result."
      ));
    }
    if (isOutput && manifest) {
      const execution = manifest.execution;
      if (!execution || execution.status !== "completed" || !text(execution.runtime) || !Number.isFinite(execution.analyzedRows) || execution.analyzedRows <= 0) {
        findings.push(finding(
          "reproducibility", "high", "Analysis execution record is incomplete",
          "The saved analysis output does not contain a completed execution record with a runtime and positive analyzed-row count.",
          "analysis", analysis.id, execution ? "Execution status: " + execution.status + "; runtime: " + (execution.runtime || "missing") + "; rows: " + (execution.analyzedRows ?? "missing") + "." : "No execution record is attached.",
          "Rerun the analysis through the documented execution path and preserve the runtime, execution status, row count and logs."
        ));
      }
      if (analysis.payload.datasetFingerprint && manifest.datasetFingerprint && analysis.payload.datasetFingerprint !== manifest.datasetFingerprint) {
        findings.push(finding(
          "calculation-consistency", "critical", "Analysis output and manifest use different dataset fingerprints",
          "The output-level dataset fingerprint does not match the fingerprint recorded in its reproducibility manifest.",
          "analysis", analysis.id, "Output: " + analysis.payload.datasetFingerprint + "; manifest: " + manifest.datasetFingerprint + ".",
          "Do not use this output. Reconcile the dataset version and rerun the analysis against one immutable dataset snapshot."
        ));
      }
      if (Number.isFinite(analysis.payload.rowCountAnalyzed) && Number.isFinite(execution?.analyzedRows) && analysis.payload.rowCountAnalyzed !== execution.analyzedRows) {
        findings.push(finding(
          "calculation-consistency", "high", "Analysis row counts do not agree",
          "The output summary and execution manifest report different analyzed-row counts.",
          "analysis", analysis.id, "Output: " + analysis.payload.rowCountAnalyzed + "; manifest: " + execution.analyzedRows + ".",
          "Inspect filters, truncation and execution logs, then regenerate the output from the documented dataset and parameters."
        ));
      }
      const tableRows = Array.isArray(analysis.payload.table?.rows) ? analysis.payload.table.rows : [];
      const invalidNumbers = tableRows.flatMap(row => Object.entries(row || {}).filter(([, value]) => typeof value === "number" && !Number.isFinite(value)).map(([key]) => key));
      if (invalidNumbers.length || Number(analysis.payload.rowCountAnalyzed) <= 0) {
        findings.push(finding(
          "calculation-consistency", "high", "Analysis output contains invalid numeric or row-count values",
          "The saved output contains non-finite numeric values or does not report a positive analyzed-row count.",
          "analysis", analysis.id, invalidNumbers.length ? "Non-finite fields: " + [...new Set(invalidNumbers)].join(", ") + "." : "Analyzed rows: " + (analysis.payload.rowCountAnalyzed ?? "missing") + ".",
          "Recheck the source data, missing-value handling and calculation pipeline before approving or citing this output."
        ));
      }
    }
    if (analysis.status === "approved" && manifest && (!manifest.ownerApproved || manifest.status !== "approved")) {
      findings.push(finding(
        "analysis-approval", "high", "Analysis approval state is inconsistent",
        "The research entity is marked approved, but its reproducibility manifest does not carry matching owner approval.",
        "analysis", analysis.id, "Entity status: " + analysis.status + "; manifest status: " + (manifest.status || "missing") + "; ownerApproved: " + Boolean(manifest.ownerApproved) + ".",
        "Reconcile the owner decision and manifest together; do not treat the output as approved until both records agree."
      ));
    }
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
  const doiOwners = new Map();
  for (const source of sources) {
    const doi = text(source.payload?.doi).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    if (doi) {
      if (doiOwners.has(doi)) findings.push(finding(
        "source-consistency", "medium", "Multiple source records share a DOI",
        "Two or more project source records use the same DOI. They may be duplicate records, but no records were merged or removed.",
        "source", source.id, "DOI " + doi + " also appears on " + doiOwners.get(doi) + ".",
        "Compare the original records and decide whether they represent the same publication before merging or retaining them."
      ));
      else doiOwners.set(doi, source.id);
    }
  }
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

  const manuscriptTitle = /\\title\s*\{([^}]*)\}/i.exec(String(project.latex || ""))?.[1]?.trim() || "";
  if (manuscriptTitle && project.name && normalizeTitle(manuscriptTitle) !== normalizeTitle(project.name)) findings.push(finding(
    "manuscript-consistency", "medium", "Project and manuscript titles differ",
    "The project title and the title in the LaTeX manuscript are not the same after basic punctuation normalization.",
    "project", project.id, "Project: " + project.name + "; manuscript: " + manuscriptTitle + ".",
    "Confirm which title is authoritative and update the project brief or manuscript so exported materials stay consistent.", "LaTeX title"
  ));

  const headings = sectionHeadings(project.latex);
  const requiredSections = project.paperType === "case-report"
    ? [{ name: "Introduction", pattern: /introduction|background/ }, { name: "Case presentation", pattern: /case presentation|case description/ }, { name: "Discussion", pattern: /discussion/ }]
    : project.paperType === "research-protocol"
      ? [{ name: "Introduction", pattern: /introduction|background/ }, { name: "Methods", pattern: /methods?|methodology|study design/ }, { name: "Ethics", pattern: /ethics|ethical considerations/ }, { name: "Dissemination", pattern: /dissemination/ }]
      : ["empirical-study", "systematic-review", "scoping-review", "dataset-analysis", "conference-paper"].includes(project.paperType)
        ? [{ name: "Introduction", pattern: /introduction|background/ }, { name: "Methods", pattern: /methods?|methodology|materials and methods/ }, { name: "Results", pattern: /results|findings/ }, { name: "Discussion", pattern: /discussion/ }, { name: "Conclusion", pattern: /conclusions?/ }]
        : [];
  for (const section of requiredSections) if (!hasHeading(headings, section.pattern)) findings.push(finding(
    "reporting-completeness", "medium", "Manuscript section may be missing: " + section.name,
    "The manuscript headings do not contain a recognizable section for this common reporting component. A different structure may be appropriate for the study.",
    "project", project.id, "Detected headings: " + (headings.join("; ") || "none") + ".",
    "Check whether a " + section.name.toLowerCase() + " section is required for this paper type and add or rename it if appropriate.", "LaTeX section headings"
  ));

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
    publisher: text(journal.publisher) || null,
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
