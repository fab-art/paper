export function normalizeDoi(value) {
  return String(value ?? "").trim().toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/[\s.,;]+$/g, "");
}

export function normalizePaperTitle(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function samePaper(left, right) {
  const leftDoi = normalizeDoi(left?.doi);
  const rightDoi = normalizeDoi(right?.doi);
  if (leftDoi && rightDoi && leftDoi === rightDoi) return true;
  const leftTitle = normalizePaperTitle(left?.title);
  return Boolean(leftTitle && leftTitle === normalizePaperTitle(right?.title));
}

export function mergePaperMetadata(existing, incoming) {
  const merged = { ...incoming, ...existing };
  for (const field of ["abstract", "url", "doi", "venue", "year", "citationCount", "openAccessPdf", "publicationDate"]) {
    if (merged[field] === undefined || merged[field] === null || merged[field] === "") merged[field] = incoming?.[field];
  }
  const authors = [...(existing?.authors ?? []), ...(incoming?.authors ?? [])];
  merged.authors = [...new Set(authors.map(value => String(value).trim()).filter(Boolean))];
  merged.source = existing?.source ?? incoming?.source ?? "semantic-scholar";
  return merged;
}

export function deduplicatePapers(papers) {
  const result = [];
  for (const paper of papers ?? []) {
    const index = result.findIndex(candidate => samePaper(candidate, paper));
    if (index < 0) result.push({ ...paper });
    else result[index] = mergePaperMetadata(result[index], paper);
  }
  return result;
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function bibtexEscape(value) {
  return String(value ?? "").replace(/[{}]/g, "").replace(/&/g, "\\&").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function paperToBibtex(paper, index = 0) {
  const author = paper.authors?.[0] ?? "Unknown";
  const surname = author.trim().split(/\s+/).at(-1)?.replace(/[^\p{L}\p{N}]/gu, "") || "unknown";
  const year = paper.year ?? "nd";
  const stem = normalizePaperTitle(paper.title).slice(0, 16) || ("paper" + (index + 1));
  const key = (surname + year + stem).toLocaleLowerCase();
  const fields = [
    "  title = {" + bibtexEscape(paper.title) + "}",
    paper.authors?.length ? "  author = {" + paper.authors.map(bibtexEscape).join(" and ") + "}" : "",
    paper.year ? "  year = {" + paper.year + "}" : "",
    paper.venue ? "  journal = {" + bibtexEscape(paper.venue) + "}" : "",
    paper.doi ? "  doi = {" + bibtexEscape(normalizeDoi(paper.doi)) + "}" : "",
    paper.url ? "  url = {" + bibtexEscape(safeExternalUrl(paper.url)) + "}" : ""
  ].filter(Boolean);
  return "@article{" + key + ",\n" + fields.join(",\n") + "\n}";
}

export function appendMissingBibtex(existingBibtex, papers) {
  const current = String(existingBibtex ?? "");
  const existingTitles = new Set(
    [...current.matchAll(/title\s*=\s*\{([^}]*)\}/gi)].map(match => normalizePaperTitle(match[1]))
  );
  const existingDois = new Set(
    [...current.matchAll(/doi\s*=\s*\{([^}]*)\}/gi)].map(match => normalizeDoi(match[1]))
  );
  const additions = [];
  for (const paper of papers ?? []) {
    const title = normalizePaperTitle(paper.title);
    const doi = normalizeDoi(paper.doi);
    if (!existingTitles.has(title) && !(doi && existingDois.has(doi))) {
      additions.push(paperToBibtex(paper, additions.length));
      existingTitles.add(title);
      if (doi) existingDois.add(doi);
    }
  }
  return [current.trim(), ...additions].filter(Boolean).join("\n\n");
}
