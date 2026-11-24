export function normalizeDoi(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/[.,;]+$/, "")
    .trim();
}

export function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function paperReviewKey(paper) {
  const doi = normalizeDoi(paper.doi);
  if (doi) return `doi:${doi}`;
  const title = normalizeTitle(paper.title);
  return `title:${title || "untitled"}`;
}

function paperReviewKeyAliases(paper) {
  const aliases = [];
  const doi = normalizeDoi(paper.doi);
  const title = normalizeTitle(paper.title);
  if (doi) aliases.push(`doi:${doi}`);
  if (title) aliases.push(`title:${title}`);
  return aliases;
}

export function deduplicatePapers(papers) {
  const seenDois = new Set();
  const seenTitles = new Set();
  const uniquePapers = [];
  let duplicatesRemoved = 0;

  for (const paper of papers || []) {
    const doi = normalizeDoi(paper.doi);
    const title = normalizeTitle(paper.title);
    const duplicate = (doi && seenDois.has(doi)) || (title && seenTitles.has(title));
    // Record aliases even for duplicates so a later record matching either
    // identifier is also recognized as the same study.
    if (doi) seenDois.add(doi);
    if (title) seenTitles.add(title);
    if (duplicate) {
      duplicatesRemoved += 1;
      continue;
    }
    uniquePapers.push({ ...paper, reviewKey: paperReviewKey(paper) });
  }

  return { uniquePapers, duplicatesRemoved };
}

export function syncReviewRecords(papers, existing = {}) {
  const { uniquePapers, duplicatesRemoved } = deduplicatePapers(papers);
  const screening = {};
  for (const paper of uniquePapers) {
    const key = paper.reviewKey;
    // A record may have been screened before DOI metadata was enriched (or
    // before a title was corrected). Re-key that decision instead of silently
    // resetting the review when the canonical identifier changes.
    const previous = paperReviewKeyAliases(paper)
      .map(alias => existing[alias])
      .find(Boolean);
    screening[key] = {
      ...(existing[key] || previous || {
        titleAbstractDecision: "pending",
        titleAbstractReason: "",
        fullTextRetrieved: false,
        fullTextDecision: "pending",
        fullTextReason: "",
        notes: "",
        updatedAt: Date.now()
      }),
      paperKey: key
    };
  }
  return { uniquePapers, screening, duplicatesRemoved };
}

export function calculatePrismaFlow(papers, screening = {}) {
  const { uniquePapers, duplicatesRemoved } = deduplicatePapers(papers);
  const records = uniquePapers.map(paper => screening[paper.reviewKey] || {});
  const screened = records.filter(record => record.titleAbstractDecision && record.titleAbstractDecision !== "pending");
  const sought = records.filter(record => ["include", "maybe"].includes(record.titleAbstractDecision));
  const assessed = sought.filter(record => record.fullTextRetrieved);
  return {
    identified: (papers || []).length,
    duplicatesRemoved,
    recordsAfterDuplicates: uniquePapers.length,
    recordsScreened: screened.length,
    recordsNotScreened: uniquePapers.length - screened.length,
    recordsExcluded: records.filter(record => record.titleAbstractDecision === "exclude").length,
    reportsSought: sought.length,
    reportsNotRetrieved: sought.filter(record => !record.fullTextRetrieved).length,
    reportsAssessed: assessed.length,
    fullTextExcluded: assessed.filter(record => record.fullTextDecision === "exclude").length,
    studiesIncluded: assessed.filter(record => record.fullTextDecision === "include").length,
    awaitingFullTextDecision: assessed.filter(record => !["include", "exclude"].includes(record.fullTextDecision)).length
  };
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function overallRisk(record) {
  const judgements = (record?.domains || []).map(domain => domain.judgement);
  if (judgements.includes("high")) return "high";
  if (judgements.includes("some-concerns")) return "some concerns";
  if (judgements.includes("unclear")) return "unclear";
  if (judgements.length && judgements.every(value => value === "low")) return "low";
  return "";
}

export function toEvidenceMatrixCsv(papers, screening = {}, extraction = {}, riskOfBias = {}) {
  const columns = [
    "title", "authors", "year", "doi", "title_abstract_decision", "title_abstract_reason",
    "full_text_retrieved", "full_text_decision", "full_text_reason", "study_design", "setting",
    "population", "sample_size", "intervention", "comparator", "outcomes", "effect_estimate",
    "limitations", "funding", "risk_of_bias_tool", "risk_of_bias_overall"
  ];
  const rows = [columns];
  const { uniquePapers } = deduplicatePapers(papers);
  for (const paper of uniquePapers) {
    const key = paper.reviewKey;
    const screen = screening[key] || {};
    const extract = extraction[key] || {};
    const bias = riskOfBias[key] || {};
    rows.push([
      paper.title, paper.authors, paper.year, paper.doi, screen.titleAbstractDecision,
      screen.titleAbstractReason, screen.fullTextRetrieved ? "yes" : "no", screen.fullTextDecision,
      screen.fullTextReason, extract.studyDesign, extract.setting, extract.population,
      extract.sampleSize, extract.intervention, extract.comparator, extract.outcomes,
      extract.effectEstimate, extract.limitations, extract.funding, bias.tool, overallRisk(bias)
    ]);
  }
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
