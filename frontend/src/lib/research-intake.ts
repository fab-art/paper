import type { ResearchPaperType } from "./research-blueprint";

export interface ResearchIntake {
  title: string;
  problemOrObservation: string;
  researchQuestion: string;
  intendedAudience: string;
  availableMaterials: string[];
  paperType: ResearchPaperType;
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
    storyArc,
    researchMode: "guided" as const,
    lifecycleState: "planning" as const,
    ownerConfirmationRequired: true as const
  };
}
