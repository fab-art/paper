import type { ResearchPaperType } from "./research-blueprint";

export interface ResearchIntake {
  title: string;
  problemOrObservation: string;
  researchQuestion: string;
  intendedAudience: string;
  availableMaterials: string[];
  paperType: ResearchPaperType;
  startPath?: ResearchEntryPath;
}

export const PAPER_TYPE_BLUEPRINTS: {
  id: ResearchPaperType; label: string; description: string; firstOutputs: string[];
}[] = [
  { id: "empirical-study", label: "Empirical study", description: "Collect or analyze observations, measurements or records to answer a research question.", firstOutputs: ["Research question", "Study design", "Dataset and analysis plan"] },
  { id: "systematic-review", label: "Systematic review", description: "Use a transparent protocol to find, screen and synthesize research studies.", firstOutputs: ["Review question", "Search protocol", "Screening criteria"] },
  { id: "scoping-review", label: "Scoping review", description: "Map the breadth, concepts and gaps in a body of literature.", firstOutputs: ["Mapping question", "Search protocol", "Evidence charting plan"] },
  { id: "case-report", label: "Case report", description: "Describe a clinically or scientifically instructive case with appropriate consent and reporting.", firstOutputs: ["Case summary", "Consent and ethics checks", "CARE-aligned outline"] },
  { id: "conference-paper", label: "Conference paper", description: "Prepare a focused contribution for a conference or proceedings.", firstOutputs: ["Contribution statement", "Target requirements", "Short manuscript outline"] },
  { id: "research-protocol", label: "Research protocol", description: "Describe a planned study before data collection or analysis.", firstOutputs: ["Research question", "Methods plan", "Ethics and registration checklist"] },
  { id: "dataset-analysis", label: "Dataset-first analysis", description: "Start with data you already have and develop a defensible question and analysis plan.", firstOutputs: ["Dataset profile", "Candidate questions", "Analysis plan"] },
  { id: "existing-manuscript", label: "Improve an existing manuscript", description: "Bring an existing draft into the workflow for evidence, methods and quality checks.", firstOutputs: ["Manuscript inventory", "Gap assessment", "Revision plan"] },
  { id: "other", label: "Other research output", description: "Start with a flexible workflow and adapt the stations as needed.", firstOutputs: ["Research brief", "Recommended route", "Next action"] },
  { id: "unspecified", label: "I'm not sure yet", description: "Start with your idea. PaperOrchestra can help you decide the most suitable format.", firstOutputs: ["Research brief", "Candidate formats", "Next action"] }
];

export function buildResearchIntake(input: ResearchIntake) {
  const title = input.title.trim() || "Untitled research project";
  const problem = input.problemOrObservation.trim();
  const question = input.researchQuestion.trim();
  const audience = input.intendedAudience.trim();
  const materials = [...new Set(input.availableMaterials.map(item => item.trim()).filter(Boolean))];
  const blueprint = PAPER_TYPE_BLUEPRINTS.find(item => item.id === input.paperType) ?? PAPER_TYPE_BLUEPRINTS[PAPER_TYPE_BLUEPRINTS.length - 1];
  const storyArc = [
    problem ? `Context: ${problem}` : "Context: describe the problem or observation.",
    "Knowledge gap: identify what is not yet known or adequately explained.",
    question ? `Research question: ${question}` : "Research question: refine and confirm the question with the researcher.",
    audience ? `Who benefits: ${audience}` : "Who benefits: identify the people or decisions this work could inform.",
    `Research output: ${blueprint.label}`
  ];
  return {
    title,
    description: problem,
    researchQuestion: question,
    intendedAudience: audience,
    availableMaterials: materials,
    paperType: input.paperType,
    startPath: input.startPath ?? "idea",
    storyArc,
    researchMode: "guided" as const,
    lifecycleState: "planning" as const,
    ownerConfirmationRequired: true as const
  };
}


export type ResearchEntryPath = "idea" | "literature" | "dataset" | "review" | "manuscript";

export const RESEARCH_ENTRY_PATHS: {
  id: ResearchEntryPath;
  label: string;
  description: string;
  firstAction: string;
  recommendedPaperTypes: ResearchPaperType[];
  route: string[];
}[] = [
  { id: "idea", label: "I have an idea", description: "Start with a problem, observation or question and shape it into a research brief.", firstAction: "Clarify the research question and intended contribution.", recommendedPaperTypes: ["empirical-study", "research-protocol", "other"], route: ["intake", "protocol", "literature", "evidence", "methods", "data", "writing"] },
  { id: "literature", label: "I have a literature question", description: "Start by finding and organizing relevant research before deciding the final paper format.", firstAction: "Build a transparent search strategy and discover sources.", recommendedPaperTypes: ["systematic-review", "scoping-review", "other"], route: ["literature", "evidence", "protocol", "methods", "writing"] },
  { id: "dataset", label: "I already have data", description: "Start by understanding the dataset, its variables, quality and limitations.", firstAction: "Profile the dataset and create a data dictionary before choosing an analysis.", recommendedPaperTypes: ["dataset-analysis", "empirical-study"], route: ["data", "protocol", "methods", "evidence", "writing"] },
  { id: "review", label: "I want to review existing studies", description: "Start with a review question, protocol and screening criteria.", firstAction: "Define the review question, eligibility criteria and search protocol.", recommendedPaperTypes: ["systematic-review", "scoping-review"], route: ["protocol", "literature", "evidence", "writing"] },
  { id: "manuscript", label: "I already have a draft", description: "Bring an existing manuscript into the workflow for evidence, methods and quality checks.", firstAction: "Inventory the manuscript, references, evidence and missing components.", recommendedPaperTypes: ["existing-manuscript", "conference-paper", "case-report"], route: ["writing", "evidence", "methods", "quality", "publication"] }
];

export function getResearchEntryPlan(path: ResearchEntryPath, paperType?: ResearchPaperType) {
  const entry = RESEARCH_ENTRY_PATHS.find(item => item.id === path) ?? RESEARCH_ENTRY_PATHS[0];
  const selectedType = paperType && paperType !== "unspecified" ? paperType : entry.recommendedPaperTypes[0];
  return {
    ...entry,
    selectedPaperType: selectedType,
    route: [...entry.route],
    firstAction: entry.id === "dataset" ? "Profile the dataset and confirm its variables before choosing an analysis."
      : entry.id === "review" ? "Define the review question, eligibility criteria and search protocol."
      : entry.id === "manuscript" ? "Inventory the manuscript, references and evidence gaps."
      : entry.id === "literature" ? "Build a transparent search strategy and discover relevant sources."
      : "Clarify the research question and intended contribution."
  };
}

export function getResearchNextAction(project: { researchQuestion?: string; paperType?: ResearchPaperType; papers?: unknown[]; methodology?: string; researchMode?: "guided" | "professional"; startPath?: ResearchEntryPath; }) {
  if (project.startPath === "dataset" || project.paperType === "dataset-analysis") return { id: "dataset-profile", title: "Profile your dataset", description: "Inspect variables, missing values and data quality before selecting an analysis.", station: "data" };
  if (project.startPath === "review" || project.paperType === "systematic-review" || project.paperType === "scoping-review") return { id: "review-protocol", title: "Define your review protocol", description: "Confirm the review question, eligibility criteria and search approach before screening.", station: "protocol" };
  if (project.startPath === "manuscript" || project.paperType === "existing-manuscript") return { id: "manuscript-inventory", title: "Review your existing manuscript", description: "Check the draft, references and evidence gaps before making revisions.", station: "writing" };
  if (project.startPath === "literature" && !project.papers?.length) return { id: "source-discovery", title: "Find and organize relevant research", description: "Start a documented literature search and save the sources you plan to use.", station: "literature" };
  if (!project.researchQuestion?.trim()) return { id: "research-question", title: "Clarify your research question", description: "Write a first version of what you want to understand. You can refine it later.", station: "intake" };
  if (!project.papers?.length) return { id: "source-discovery", title: "Find and organize relevant research", description: "Start a documented literature search and save the sources you plan to use.", station: "literature" };
  if (!project.methodology?.trim()) return { id: "methods-plan", title: "Outline your research methods", description: "Record the study design, setting, population, outcomes and analysis plan.", station: "methods" };
  return { id: "evidence-check", title: "Connect evidence to your key claims", description: "Link important statements to source passages or verified analysis outputs.", station: "evidence" };
}
