import type { Project, OutlineSection } from "./types";
import type { ResearchPaperType } from "./research-blueprint";
import { writingPrompt } from "../agents/prompts.ts";

export type WritingAuthorVoice = "preserve" | "formal" | "concise" | "accessible";
export interface WritingSectionGuide {
  purpose: string;
  microPrompts: string[];
  sentenceStarters: string[];
  defaultWordTarget: number;
  evidenceReminder: string;
}

const GENERIC_GUIDE: WritingSectionGuide = {
  purpose: "Explain what this section contributes to the research argument and how it connects to the study question.",
  microPrompts: ["What does the reader need to understand here?", "Which facts or decisions can be traced to evidence?", "What limitation or uncertainty should be made explicit?"],
  sentenceStarters: ["This section examines…", "The analysis is organized around…", "Taken together, these findings suggest…"],
  defaultWordTarget: 400,
  evidenceReminder: "Support factual statements with a linked passage or verified analysis output."
};

export function getWritingSectionGuide(sectionTitle: string, paperType: ResearchPaperType = "unspecified"): WritingSectionGuide {
  const title = sectionTitle.toLowerCase();
  if (/abstract|summary/.test(title)) return {
    purpose: "Give a self-contained summary of the problem, approach, main verified findings and contribution.",
    microPrompts: ["What problem does the work address?", "What design or approach was used?", "What are the main verified results?", "What is the practical or scientific contribution?"],
    sentenceStarters: ["Background: …", "Methods: …", "Results: …", "Conclusion: …"],
    defaultWordTarget: paperType === "conference-paper" ? 200 : 250,
    evidenceReminder: "Include results only when they exist in approved analysis outputs; do not invent numerical findings."
  };
  if (/introduction|background|rationale/.test(title)) return {
    purpose: "Introduce the problem, explain what is already known, identify the knowledge gap and state the research aim.",
    microPrompts: ["Who is affected by the problem and in what context?", "What does the strongest available literature already show?", "What remains uncertain or insufficiently studied?", "How does this study address that gap?"],
    sentenceStarters: ["The problem of … remains important because …", "Previous research has established …", "However, evidence remains limited regarding …", "This study therefore aims to …"],
    defaultWordTarget: 650,
    evidenceReminder: "Use source-linked passages for literature claims and distinguish established evidence from the study rationale."
  };
  if (/method|design|protocol|procedure/.test(title)) return {
    purpose: "Explain how the study was designed and carried out so another researcher can understand and assess the methods.",
    microPrompts: ["What design was used, and why is it suitable?", "Where and when was the study conducted?", "Who or what was eligible, and how were they selected?", "Which variables, outcomes and procedures were defined?", "How were data analyzed, and what assumptions apply?", "What ethics approvals or consent processes are documented?"],
    sentenceStarters: ["We used a … design to …", "The study was conducted in …", "Eligible participants/data were defined as …", "The primary outcome was …", "Analyses were performed using …"],
    defaultWordTarget: 850,
    evidenceReminder: "Do not invent approvals, registration, sample sizes or procedures. Mark missing details as [SOURCE NEEDED] or an owner question."
  };
  if (/result|finding|outcome/.test(title)) return {
    purpose: "Report what the analysis actually found, in the order of the research objectives, without adding interpretation that belongs in the discussion.",
    microPrompts: ["Which approved analysis output answers each objective?", "What are the denominators, units and uncertainty intervals?", "Are missing data or sensitivity analyses relevant?", "Do the tables and text report consistent values?"],
    sentenceStarters: ["The analysis included …", "For the primary outcome, …", "The estimate was … with …", "A sensitivity analysis showed …"],
    defaultWordTarget: 650,
    evidenceReminder: "Use only approved/verified analysis outputs. Never create results, denominators, confidence intervals or p-values."
  };
  if (/discussion|interpretation/.test(title)) return {
    purpose: "Explain what the findings mean, compare them with prior evidence, discuss implications and acknowledge limitations.",
    microPrompts: ["What is the main interpretation of each finding?", "How does it compare with source-linked prior research?", "What explanations are plausible and what remains uncertain?", "What are the implications for practice, policy or future research?", "Which limitations could change the interpretation?"],
    sentenceStarters: ["The principal finding of this study was …", "This is consistent with …", "One possible explanation is …", "These findings may have implications for …", "Several limitations should be considered …"],
    defaultWordTarget: 900,
    evidenceReminder: "Separate observed results from interpretation; preserve contradictory evidence and avoid causal language unsupported by the design."
  };
  if (/conclusion|implication/.test(title)) return {
    purpose: "Answer the research question briefly, state the contribution and avoid claims that go beyond the evidence.",
    microPrompts: ["What is the most defensible answer to the research question?", "What contribution does the work make?", "What should readers not conclude from these results?", "What is the most useful next step?"],
    sentenceStarters: ["In conclusion, this study …", "The findings support …", "Further work is needed to …"],
    defaultWordTarget: 250,
    evidenceReminder: "Do not introduce new findings or stronger claims than those already supported in the manuscript."
  };
  if (/literature|related work|evidence synthesis/.test(title)) return {
    purpose: "Synthesize what the included sources collectively show, where they agree or differ, and where evidence is missing.",
    microPrompts: ["Which themes recur across the included sources?", "Where do findings agree or conflict?", "How do study settings or methods explain differences?", "What evidence gaps remain?"],
    sentenceStarters: ["Across the included studies, …", "A recurring theme was …", "However, findings differed regarding …", "The available evidence remains limited by …"],
    defaultWordTarget: 750,
    evidenceReminder: "Synthesize source-linked evidence; do not treat titles, abstracts or metadata as passages you have read."
  };
  return GENERIC_GUIDE;
}

const voiceInstructions: Record<WritingAuthorVoice, string> = {
  preserve: "Preserve the author's existing voice, terminology, sentence rhythm and level of formality. Improve clarity without making the prose sound generic.",
  formal: "Use formal academic language, precise terminology and restrained claims. Avoid conversational phrasing.",
  concise: "Use concise academic prose. Remove repetition and unnecessary qualifiers without losing methodological or scientific detail.",
  accessible: "Use clear, accessible scholarly language. Explain specialized terms where needed while retaining scientific precision."
};

export function buildWritingBlockPrompt(
  project: Project,
  section: OutlineSection,
  evidenceContext: string,
  options: { wordTarget?: number; authorVoice?: WritingAuthorVoice; microPrompt?: string } = {}
): string {
  const guide = getWritingSectionGuide(section.title, project.paperType ?? "unspecified");
  const wordTarget = Number.isFinite(options.wordTarget) ? Math.max(50, Math.min(10000, Math.round(options.wordTarget!))) : guide.defaultWordTarget;
  const focusedPrompt = options.microPrompt?.trim();
  return [
    writingPrompt(project, section, evidenceContext),
    "SECTION-WRITING WORKFLOW:",
    "Plain-language purpose: " + guide.purpose,
    "Target length: approximately " + wordTarget + " words. Stay within about 15% unless the available evidence cannot support that length.",
    "Author voice: " + voiceInstructions[options.authorVoice ?? "preserve"],
    "Evidence discipline: " + guide.evidenceReminder,
    "Section micro-prompts:",
    ...guide.microPrompts.map((item, index) => (index + 1) + ". " + item),
    focusedPrompt ? "Researcher focus for this pass: " + focusedPrompt : "",
    "Do not answer a micro-prompt by inventing information. Use [SOURCE NEEDED] or state that the owner must supply the missing detail."
  ].filter(Boolean).join("\n");
}

export interface DraftEvidenceItem { claim: string; evidenceId?: string; status: "evidence-linked" | "awaiting-verification"; reason?: string; }

function precedingClaim(text: string, markerIndex: number): string {
  const prefix = text.slice(0, markerIndex).slice(-700).trim();
  const segments = prefix.split(/(?:\\par\b|\n|(?<=[.!?])\s+)/);
  return (segments[segments.length - 1] ?? prefix)
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, " ")
    .replace(/[{}$]/g, "")
    .trim();
}

export function inspectDraftEvidence(latex: string, availableEvidenceIds: string[]): { linked: DraftEvidenceItem[]; unresolved: DraftEvidenceItem[] } {
  const available = new Set(availableEvidenceIds);
  const linked: DraftEvidenceItem[] = [];
  const unresolved: DraftEvidenceItem[] = [];
  const evidencePattern = /\[EVIDENCE:\s*([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = evidencePattern.exec(latex)) !== null) {
    const evidenceId = match[1].trim();
    const claim = precedingClaim(latex, match.index) || "Claim awaiting a clearer sentence-level link";
    if (available.has(evidenceId)) linked.push({ claim, evidenceId, status: "evidence-linked" });
    else unresolved.push({ claim, evidenceId, status: "awaiting-verification", reason: "This evidence ID is not in the available evidence set." });
  }
  const neededPattern = /([^.\n!?]*[.!?]?)\s*\[SOURCE NEEDED\]/g;
  while ((match = neededPattern.exec(latex)) !== null) {
    unresolved.push({ claim: match[1].trim() || "Factual statement without a source", status: "awaiting-verification", reason: "The draft explicitly marks this claim as source needed." });
  }
  return { linked, unresolved };
}

export function checkCitationKeys(latex: string, bibtex: string): { citedKeys: string[]; missingKeys: string[]; unusedKeys: string[]; duplicateKeys: string[] } {
  const cited = new Set<string>();
  const bibKeys: string[] = [];
  const citationPattern = /\\(?:cite|citep|citet|autocite|parencite|textcite)\*?(?:\[[^\]]*\]){0,2}\{([^}]+)\}/g;
  const bibPattern = /@(article|book|inproceedings|conference|incollection|inbook|phdthesis|mastersthesis|techreport|misc|online|manual|unpublished|report|software|dataset|proceedings)\s*\{\s*([^,\s]+)\s*,/gi;
  let match: RegExpExecArray | null;
  while ((match = citationPattern.exec(latex)) !== null) for (const key of match[1].split(",").map(value => value.trim()).filter(Boolean)) cited.add(key);
  while ((match = bibPattern.exec(bibtex)) !== null) bibKeys.push(match[2].trim());
  const available = new Set(bibKeys);
  const counts = new Map<string, number>();
  for (const key of bibKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return {
    citedKeys: [...cited].sort(),
    missingKeys: [...cited].filter(key => !available.has(key)).sort(),
    unusedKeys: [...available].filter(key => !cited.has(key)).sort(),
    duplicateKeys: [...counts].filter(([, count]) => count > 1).map(([key]) => key).sort()
  };
}
