export function normalizeDoi(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
}

export function normalizePaperTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function isSavedPaper(candidate, savedPapers = []) {
  const doi = normalizeDoi(candidate?.doi);
  const title = normalizePaperTitle(candidate?.title);
  if (!doi && !title) return false;
  return savedPapers.some(paper =>
    (doi && normalizeDoi(paper?.doi) === doi) ||
    (title && normalizePaperTitle(paper?.title) === title)
  );
}

export function safeExternalUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
