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

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function paperReviewKey(paper, index = 0) {
  const doi = normalizeDoi(paper.doi);
  if (doi) return `doi:${doi}`;
  const title = normalizeTitle(paper.title);
  if (title) return `title:${title}`;
  const id = String(paper.id || "").trim();
  if (id) return `id:${id}`;
  const url = normalizeUrl(paper.url);
  if (url) return `url:${url}`;
  return `record:${index}`;
}

function paperReviewKeyAliases(paper, index = 0) {
  const aliases = [];
  const doi = normalizeDoi(paper.doi);
  const title = normalizeTitle(paper.title);
  const id = String(paper.id || "").trim();
  const url = normalizeUrl(paper.url);
  if (doi) aliases.push(`doi:${doi}`);
  if (title) aliases.push(`title:${title}`);
  if (id) aliases.push(`id:${id}`);
  if (url) aliases.push(`url:${url}`);
  if (!aliases.length) aliases.push(`record:${index}`);
  return aliases;
}

export function deduplicatePapers(papers) {
  const source = Array.isArray(papers) ? papers : [];
  const parent = source.map((_, index) => index);

  const find = index => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  const seen = {
    doi: new Map(),
    title: new Map(),
    id: new Map(),
    url: new Map()
  };

  source.forEach((paper, index) => {
    const identifiers = [
      ["doi", normalizeDoi(paper.doi)],
      ["title", normalizeTitle(paper.title)],
      ["id", String(paper.id || "").trim()],
      ["url", normalizeUrl(paper.url)]
    ];
    for (const [kind, identifier] of identifiers) {
      if (!identifier) continue;
      const prior = seen[kind].get(identifier);
      if (prior !== undefined) union(index, prior);
      else seen[kind].set(identifier, index);
    }
  });

  const groups = new Map();
  source.forEach((paper, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(index);
  });

  const uniquePapers = [];
  const aliasesByReviewKey = {};
  for (const indices of groups.values()) {
    const firstIndex = indices[0];
    const firstPaper = source[firstIndex];
    const key = paperReviewKey(firstPaper, firstIndex);
    uniquePapers.push({ ...firstPaper, reviewKey: key });

    const aliases = new Set([key]);
    for (const index of indices) {
      const paper = source[index];
      aliases.add(paperReviewKey(paper, index));
      for (const alias of paperReviewKeyAliases(paper, index)) aliases.add(alias);
    }
    aliasesByReviewKey[key] = [...aliases];
  }

  return {
    uniquePapers,
    duplicatesRemoved: source.length - uniquePapers.length,
    aliasesByReviewKey
  };
}

function latestRecord(records, timestampField = "updatedAt") {
  return [...records].sort((a, b) =>
    Number(b?.[timestampField] ?? b?.updatedAt ?? 0) -
    Number(a?.[timestampField] ?? a?.updatedAt ?? 0)
  )[0] || null;
}

function hasTimestamp(record, field) {
  return record?.[field] !== undefined &&
    record?.[field] !== null &&
    Number.isFinite(Number(record[field]));
}

function chooseDecisionRecord(records, field, timestampField) {
  const timestamped = records.filter(record => hasTimestamp(record, timestampField));
  if (timestamped.length) return latestRecord(timestamped, timestampField);

  const candidates = records.filter(record =>
    typeof record?.[field] === "string" && record[field].trim()
  );
  if (!candidates.length) return null;
  const substantive = candidates.filter(record => record[field] !== "pending");
  return latestRecord(substantive.length ? substantive : candidates);
}

function mergeUniqueText(previous, next) {
  const parts = [
    ...String(previous || "").split(/\n{2,}/),
    ...String(next || "").split(/\n{2,}/)
  ].map(value => value.trim()).filter(Boolean);
  return [...new Set(parts)].join("\n\n");
}

function mergeObjectPreservingValues(previous, next) {
  const result = { ...(previous || {}) };
  for (const [key, value] of Object.entries(next || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}

function mergeDomainLists(previous = [], next = []) {
  const merged = new Map();
  for (const [index, domain] of [...previous, ...next].entries()) {
    if (!domain || typeof domain !== "object") continue;
    const key = String(domain.id || domain.name || `domain:${index}`);
    merged.set(key, mergeObjectPreservingValues(merged.get(key), domain));
  }
  return [...merged.values()];
}

function mergeReviewRecords(records) {
  const ordered = records
    .filter(record => record && typeof record === "object")
    .sort((a, b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0));
  if (!ordered.length) return null;

  const merged = {};
  const specialFields = new Set([
    "paperKey", "updatedAt",
    "titleAbstractDecision", "titleAbstractReason", "titleAbstractDecisionUpdatedAt",
    "fullTextDecision", "fullTextReason", "fullTextDecisionUpdatedAt",
    "fullTextRetrieved", "fullTextRetrievedUpdatedAt"
  ]);

  for (const record of ordered) {
    for (const [field, value] of Object.entries(record)) {
      if (specialFields.has(field) || value === undefined || value === null) continue;
      if (typeof value === "string") {
        if (!value.trim()) continue;
        merged[field] = field === "notes"
          ? mergeUniqueText(merged[field], value)
          : value;
      } else if (Array.isArray(value)) {
        if (field === "domains") {
          merged[field] = mergeDomainLists(merged[field] || [], value);
        } else {
          const combined = [...(merged[field] || []), ...value];
          const seen = new Set();
          merged[field] = combined.filter(item => {
            const key = JSON.stringify(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      } else if (typeof value === "object") {
        merged[field] = mergeObjectPreservingValues(merged[field], value);
      } else {
        merged[field] = value;
      }
    }
  }

  const titleDecisionRecord = chooseDecisionRecord(
    ordered, "titleAbstractDecision", "titleAbstractDecisionUpdatedAt"
  );
  if (titleDecisionRecord) {
    merged.titleAbstractDecision = titleDecisionRecord.titleAbstractDecision;
    merged.titleAbstractDecisionUpdatedAt = titleDecisionRecord.titleAbstractDecisionUpdatedAt;
    if (titleDecisionRecord.titleAbstractReason) {
      merged.titleAbstractReason = titleDecisionRecord.titleAbstractReason;
    }
  }

  const fullTextDecisionRecord = chooseDecisionRecord(
    ordered, "fullTextDecision", "fullTextDecisionUpdatedAt"
  );
  if (fullTextDecisionRecord) {
    merged.fullTextDecision = fullTextDecisionRecord.fullTextDecision;
    merged.fullTextDecisionUpdatedAt = fullTextDecisionRecord.fullTextDecisionUpdatedAt;
    if (fullTextDecisionRecord.fullTextReason) {
      merged.fullTextReason = fullTextDecisionRecord.fullTextReason;
    }
  }

  const updateTimes = ordered
    .map(record => Number(record.updatedAt))
    .filter(value => Number.isFinite(value));
  if (updateTimes.length) merged.updatedAt = Math.max(...updateTimes);

  const hasFullTextState = ordered.some(record =>
    "fullTextRetrieved" in record ||
    "fullTextDecision" in record ||
    hasTimestamp(record, "fullTextRetrievedUpdatedAt") ||
    hasTimestamp(record, "fullTextDecisionUpdatedAt")
  );
  if (hasFullTextState) {
    const retrievedRecord = latestRecord(
      ordered.filter(record => hasTimestamp(record, "fullTextRetrievedUpdatedAt")),
      "fullTextRetrievedUpdatedAt"
    );
    if (retrievedRecord) {
      merged.fullTextRetrieved = Boolean(retrievedRecord.fullTextRetrieved);
      merged.fullTextRetrievedUpdatedAt = retrievedRecord.fullTextRetrievedUpdatedAt;
    } else if (fullTextDecisionRecord && hasTimestamp(fullTextDecisionRecord, "fullTextDecisionUpdatedAt")) {
      merged.fullTextRetrieved = Boolean(fullTextDecisionRecord.fullTextRetrieved);
    } else {
      merged.fullTextRetrieved = ordered.some(record => record.fullTextRetrieved === true);
    }
  }
  return merged;
}

export function migrateReviewRecords(papers, existing = {}) {
  const { uniquePapers, aliasesByReviewKey } = deduplicatePapers(papers);
  const migrated = {};
  for (const paper of uniquePapers) {
    const key = paper.reviewKey;
    const aliases = aliasesByReviewKey[key] || [key, ...paperReviewKeyAliases(paper)];
    const records = [...new Set(aliases.map(alias => existing[alias]).filter(Boolean))];
    const merged = mergeReviewRecords(records);
    if (merged) migrated[key] = merged;
  }
  return migrated;
}

export function updateTitleAbstractDecision(record, decision, now = Date.now()) {
  const next = {
    ...record,
    titleAbstractDecision: decision,
    titleAbstractDecisionUpdatedAt: now,
    updatedAt: now
  };
  if (decision === "exclude" || decision === "pending") {
    next.fullTextRetrieved = false;
    next.fullTextDecision = "pending";
    next.fullTextReason = "";
    next.fullTextDecisionUpdatedAt = now;
    next.fullTextRetrievedUpdatedAt = now;
  }
  return next;
}

export function syncReviewRecords(papers, existing = {}) {
  const { uniquePapers, duplicatesRemoved } = deduplicatePapers(papers);
  // Pass the original list so records on identifiers belonging to duplicates
  // are migrated into the canonical record instead of being discarded.
  const migrated = migrateReviewRecords(papers, existing);
  const screening = {};
  for (const paper of uniquePapers) {
    const key = paper.reviewKey;
    screening[key] = {
      ...(migrated[key] || {
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
  let text = value === undefined || value === null
    ? ""
    : Array.isArray(value)
      ? value.join("; ")
      : String(value);

  const isUserText = typeof value === "string" || Array.isArray(value);
  if (isUserText) {
    const isNegativeNumber = /^-(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim());
    const startsWithControl = /^[\u0000-\u001f]/.test(text);
    const formulaPrefix = /^[\u0000-\u0020]*[=+@＝＋＠]/.test(text) ||
      (/^[\u0000-\u0020]*[-－]/.test(text) && !isNegativeNumber);
    if (startsWithControl || formulaPrefix) text = "'" + text;
  }

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
