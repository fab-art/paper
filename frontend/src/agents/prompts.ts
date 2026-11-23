import type { Project, OutlineSection, Paper } from "../lib/types";

const compact = (value: unknown) => JSON.stringify(value).slice(0, 12000);
export function outlinePrompt(project: Project) {
  return `You are a concise academic research-structure agent. Return ONLY valid JSON, no markdown fences.
Schema: {"title":"...","research_question":"...","sections":[{"id":"s1","title":"...","description":"...","children":[]}]}
Create a coherent, evidence-conscious outline from these notes. Do not invent results.
NOTES: ${project.notes.slice(0, 7000)}
TEMPLATE: ${project.template}`;
}
export function literatureQueryPrompt(project: Project, outline: OutlineSection[]) {
  return `Act as an academic librarian. Return ONLY JSON: {"queries":["..."],"citation_needs":["..."]}.
Create 3-5 precise Semantic Scholar search queries aligned to this outline. Never invent references.
NOTES: ${project.notes.slice(0, 3000)}
OUTLINE: ${compact(outline)}`;
}
export function bibPrompt(papers: Paper[]) {
  return `Convert only these supplied paper metadata into BibTeX. Return ONLY BibTeX entries. Do not invent missing DOI, pages, issue, or author names. Use stable citation keys.
PAPERS: ${compact(papers)}`;
}
export function plotPrompt(project: Project) {
  return `You are a research data visualization planner. Return ONLY JSON {"x":"column","y":"column","title":"...","reason":"..."}.
Choose one categorical/time x column and one numeric outcome y column from this dataset. Do not invent columns or data.
DATA SAMPLE: ${project.logs.slice(0, 5000)}`;
}
export function writingPrompt(project: Project, section: OutlineSection) {
  return `You are an academic LaTeX writing assistant. Draft ONLY the LaTeX body for this section (no document preamble).
Use cautious claims, clear academic tone, and cite only keys present in the supplied bibliography. Insert [SOURCE NEEDED] where evidence is missing. Never fabricate results or references.
SECTION: ${section.title}
DESCRIPTION: ${section.description}
NOTES: ${project.notes.slice(0, 4500)}
BIBLIOGRAPHY: ${project.bibtex.slice(0, 3500)}
EXISTING DRAFT: ${project.latex.slice(0, 3000)}`;
}
export function refinePrompt(project: Project) {
  return `Review this LaTeX manuscript. Return ONLY JSON {"issues":["..."],"revised_latex":"..."}.
Preserve meaning and all factual uncertainty. Check balanced braces/environments, citation keys against the bibliography, duplicated text, and academic tone. Do not invent citations or findings.
LATEX: ${project.latex.slice(0, 9000)}
BIB: ${project.bibtex.slice(0, 3500)}`;
}
