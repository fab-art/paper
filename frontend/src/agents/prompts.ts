import type { Project, OutlineSection, Paper } from "../lib/types";

const compact = (value: unknown) => JSON.stringify(value).slice(0, 12000);

export function researchBrief(project: Project, maxLength = 6500) {
  const additionalNotes = project.researchQuestion
    ? project.notes.replace(/^Research question:[^\\r\\n]*(?:\\r?\\n)?/i, "").trim()
    : project.notes;
  return [
    project.researchQuestion ? `RESEARCH QUESTION: ${project.researchQuestion}` : "",
    project.objectives?.length ? `RESEARCH OBJECTIVES:\n${project.objectives.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "",
    project.methodology ? `METHODOLOGY AND APPROACH: ${project.methodology}` : "",
    additionalNotes ? `ADDITIONAL PROJECT NOTES: ${additionalNotes}` : ""
  ].filter(Boolean).join("\n\n").slice(0, maxLength);
}

export function outlinePrompt(project: Project) {
  return `You are a concise academic research-structure agent. Return ONLY valid JSON, no markdown fences.
Schema: {"title":"...","research_question":"...","sections":[{"id":"s1","title":"...","description":"...","children":[]}]}
Create a coherent, evidence-conscious outline from the complete project brief. Preserve the research question, objectives and methodology. Do not invent results.
PROJECT BRIEF:
${researchBrief(project)}
TEMPLATE: ${project.template}`;
}
export function literatureQueryPrompt(project: Project, outline: OutlineSection[]) {
  return `Act as an academic librarian. Return ONLY JSON: {"queries":["..."],"citation_needs":["..."]}.
Create 3-5 precise Semantic Scholar search queries aligned to the project brief and outline. Never invent references.
PROJECT BRIEF:
${researchBrief(project, 3500)}
OUTLINE: ${compact(outline)}`;
}
export function bibPrompt(papers: Paper[]) {
  return `Convert only these supplied paper metadata into BibTeX. Return ONLY BibTeX entries. Do not invent missing DOI, pages, issue, or author names. Use stable citation keys.
PAPERS: ${compact(papers)}`;
}
export function plotPrompt(project: Project) {
  return `You are a research data visualization planner. Return ONLY JSON {"x":"column","y":"column","title":"...","reason":"..."}.
Choose one categorical/time x column and one numeric outcome y column from this dataset. Do not invent columns or data.
DATA SAMPLE: ${project.logs.slice(0, 5000)}
PROJECT CONTEXT: ${researchBrief(project, 1500)}`;
}
export function writingPrompt(project: Project, section: OutlineSection, evidenceContext = "No verified source passages or approved analysis outputs are available.") {
  return `You are an academic LaTeX writing assistant. Draft ONLY the LaTeX body for this section (no document preamble).
Use cautious claims, clear academic tone, and cite only keys present in the supplied bibliography. Insert [SOURCE NEEDED] where evidence is missing. Never fabricate results or references.
SECTION: ${section.title}
DESCRIPTION: ${section.description}
PROJECT BRIEF:
${researchBrief(project, 4500)}
BIBLIOGRAPHY: ${project.bibtex.slice(0, 3500)}
EXISTING DRAFT: ${project.latex.slice(0, 3000)}\nTRACEABLE PROJECT EVIDENCE:\n${evidenceContext}\nFor each factual statement, append [EVIDENCE: entity-id] only when the supplied passage/result directly supports it. Otherwise insert [SOURCE NEEDED]. Never treat a title or abstract as a read passage.`;
}
export function refinePrompt(
  project: Project,
  focus: "clarity" | "academic" = "clarity",
  authorVoice: "preserve" | "formal" | "concise" | "accessible" = "preserve"
) {
  const focusInstruction = focus === "academic"
    ? "Convert plain-language, informal or note-like passages into clear academic prose. Preserve the author's intended meaning, uncertainty and terminology; do not make claims more certain."
    : "Improve clarity, logical flow, sentence structure and concision while preserving the author's intended meaning.";
  const voiceInstruction = authorVoice === "preserve"
    ? "Preserve the author's existing voice and phrasing patterns wherever possible."
    : authorVoice === "formal"
      ? "Use formal academic language and precise terminology."
      : authorVoice === "concise"
        ? "Prefer concise academic prose without removing essential scientific detail."
        : "Use accessible scholarly language and explain specialized terms where useful.";
  return \`Review this LaTeX manuscript against the supplied research brief. Return ONLY JSON {"issues":["..."],"revised_latex":"..."}.
\${focusInstruction}
\${voiceInstruction}
Preserve all factual uncertainty. Check alignment with the research question, balanced braces/environments, citation keys against the bibliography, duplicated text and unsupported factual claims. Do not invent citations, methods, approvals or findings.
PROJECT BRIEF:
\${researchBrief(project, 2500)}
LATEX: \${project.latex.slice(0, 9000)}
BIB: \${project.bibtex.slice(0, 3500)}\`;
}
