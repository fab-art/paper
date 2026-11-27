export function createProjectDraft({ id, name, now = Date.now() }) {
  return {
    id,
    name: String(name ?? "").trim(),
    notes: "",
    latex: "",
    bibtex: "",
    template: "default",
    outline: [],
    papers: [],
    figures: [],
    logs: "",
    agentRecords: [],
    updatedAt: now,
    revision: 0,
    researchQuestion: "",
    objectives: [],
    methodology: "",
    status: "planning",
    milestones: [],
    submissionChecks: {},
    researchMode: "guided"
  };
}

export function validateProjectDraft(project) {
  const name = String(project?.name ?? "").trim();
  if (!name) return "Project name is required.";
  if (name.length > 200) return "Project name must be 200 characters or fewer.";
  return "";
}

export function filterProjects(projects, query) {
  const normalized = String(query ?? "").trim().toLocaleLowerCase();
  if (!normalized) return [...projects];
  return projects.filter(project => [
    project.name,
    project.researchQuestion,
    ...(Array.isArray(project.objectives) ? project.objectives : [])
  ].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized));
}

export function getProjectCollection(projects) {
  const byRecent = (a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0);
  return {
    active: projects.filter(project => !project.archivedAt).sort(byRecent),
    archived: projects.filter(project => Boolean(project.archivedAt)).sort(byRecent)
  };
}

export function toggleMilestone(project, milestoneId, completed) {
  if (!project.milestones?.some(item => item.id === milestoneId)) return project;
  return {
    ...project,
    milestones: project.milestones.map(item => item.id === milestoneId ? { ...item, completed } : item)
  };
}

export function projectRoute(projectId) {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function isDuplicatePaper(existingPapers, candidate) {
  const normalizeTitle = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const normalizeDoi = value => String(value ?? "").toLocaleLowerCase().trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
  const candidateDoi = normalizeDoi(candidate?.doi);
  const candidateTitle = normalizeTitle(candidate?.title);
  return existingPapers.some(paper =>
    (candidateDoi && normalizeDoi(paper?.doi) === candidateDoi) ||
    (candidateTitle && normalizeTitle(paper?.title) === candidateTitle)
  );
}
