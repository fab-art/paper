const AGENT_IDS = ["outline", "literature", "plots", "writing", "refine"];

const DEFAULT_LATEX = [
  "\\documentclass{article}",
  "\\usepackage{graphicx}",
  "\\usepackage{natbib}",
  "\\title{Research Manuscript}",
  "\\begin{document}",
  "\\maketitle",
  "\\end{document}"
].join("\n");

export function createProjectRecord(input = {}, options = {}) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Project name is required.");
  if (name.length > 180) throw new Error("Project name must be 180 characters or fewer.");

  const id = String(options.id ?? "").trim();
  if (!id) throw new Error("Project ID is required.");

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const availableMaterials = Array.isArray(input.availableMaterials)
    ? input.availableMaterials.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    id,
    name,
    notes: String(input.description ?? "").trim()
      ? `Research context: ${String(input.description).trim()}`
      : "",
    researchQuestion: String(input.researchQuestion ?? "").trim() || undefined,
    paperType: input.paperType || "unspecified",
    intendedAudience: String(input.intendedAudience ?? "").trim() || undefined,
    availableMaterials,
    storyArc: Array.isArray(input.storyArc)
      ? input.storyArc.map((item) => String(item).trim()).filter(Boolean)
      : [],
    researchMode: input.researchMode === "professional" ? "professional" : "guided",
    latex: DEFAULT_LATEX,
    bibtex: "",
    template: "Generic Article",
    outline: [],
    papers: [],
    figures: [],
    logs: "",
    templateFiles: {},
    agentRecords: AGENT_IDS.map((agentId) => ({
      id: agentId,
      status: "idle",
      summary: "",
      updatedAt: now
    })),
    updatedAt: now,
    status: "planning",
    milestones: []
  };
}

export function normalizeDoi(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^https?:\\/\\/(dx\\.)?doi\\.org\\//, "")
    .replace(/^doi:\\s*/, "");
}

export function normalizePaperTitle(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\\p{L}\\p{N}]/gu, "");
}

export function isDuplicatePaper(papers, candidate) {
  const doi = normalizeDoi(candidate?.doi);
  const title = normalizePaperTitle(candidate?.title);
  if (!doi && !title) return false;

  return (papers ?? []).some((paper) =>
    (doi && normalizeDoi(paper?.doi) === doi) ||
    (title && normalizePaperTitle(paper?.title) === title)
  );
}

export function isArchivedProject(project) {
  return Boolean(project?.archivedAt);
}
