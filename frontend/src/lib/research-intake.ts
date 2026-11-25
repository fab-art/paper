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

export function getResearchNextAction(project: { researchQuestion?: string; paperType?: ResearchPaperType; papers?: unknown[]; methodology?: string; researchMode?: "guided" | "professional"; startPath?: ResearchEntryPath; }, plan?: ResearchStationPlan) {
  if (plan) {
    for (const station of plan.stations) {
      const task = station.tasks.find(item => !item.completed);
      if (task) return { id: task.id, title: task.title, description: task.description, station: station.stationId };
    }
    return { id: "plan-review", title: "Review your completed research plan", description: "All planned steps are marked complete. Check the supporting outputs and owner decisions before moving forward.", station: plan.stations.find(item => item.stationId === "quality")?.stationId ?? plan.stations.at(-1)?.stationId ?? "intake" };
  }
  if (project.startPath === "dataset" || project.paperType === "dataset-analysis") return { id: "dataset-profile", title: "Profile your dataset", description: "Inspect variables, missing values and data quality before selecting an analysis.", station: "data" };
  if (project.startPath === "review" || project.paperType === "systematic-review" || project.paperType === "scoping-review") return { id: "review-protocol", title: "Define your review protocol", description: "Confirm the review question, eligibility criteria and search approach before screening.", station: "protocol" };
  if (project.startPath === "manuscript" || project.paperType === "existing-manuscript") return { id: "manuscript-inventory", title: "Review your existing manuscript", description: "Check the draft, references and evidence gaps before making revisions.", station: "writing" };
  if (project.startPath === "literature" && !project.papers?.length) return { id: "source-discovery", title: "Find and organize relevant research", description: "Start a documented literature search and save the sources you plan to use.", station: "literature" };
  if (!project.researchQuestion?.trim()) return { id: "research-question", title: "Clarify your research question", description: "Write a first version of what you want to understand. You can refine it later.", station: "intake" };
  if (!project.papers?.length) return { id: "source-discovery", title: "Find and organize relevant research", description: "Start a documented literature search and save the sources you plan to use.", station: "literature" };
  if (!project.methodology?.trim()) return { id: "methods-plan", title: "Outline your research methods", description: "Record the study design, setting, population, outcomes and analysis plan.", station: "methods" };
  return { id: "evidence-check", title: "Connect evidence to your key claims", description: "Link important statements to source passages or verified analysis outputs.", station: "evidence" };
}


export type ResearchPlanStationId =
  | "intake" | "protocol" | "literature" | "evidence" | "methods" | "data"
  | "writing" | "quality" | "peer-review" | "publication" | "revision";

export interface ResearchPlanTask {
  id: string;
  stationId: ResearchPlanStationId;
  title: string;
  description: string;
  completed: boolean;
  origin: "blueprint" | "researcher";
}

export interface ResearchPlanStation {
  stationId: ResearchPlanStationId;
  label: string;
  purpose: string;
  tasks: ResearchPlanTask[];
}

export interface ResearchPlanMilestone {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
}

export interface ResearchStationPlan {
  schemaVersion: 1;
  paperType: ResearchPaperType;
  entryPath: ResearchEntryPath;
  stations: ResearchPlanStation[];
  milestones: ResearchPlanMilestone[];
  updatedAt: number;
}

const PLAN_STATION_DETAILS: Record<ResearchPlanStationId, { label: string; purpose: string }> = {
  intake: { label: "Research order", purpose: "Clarify the problem, question, audience and contribution." },
  protocol: { label: "Planning & protocol", purpose: "Make the research design, eligibility and methods explicit." },
  literature: { label: "Literature discovery", purpose: "Search for and organize relevant sources transparently." },
  evidence: { label: "Evidence processing", purpose: "Assess sources and connect evidence to claims." },
  methods: { label: "Methods & compliance", purpose: "Specify variables, analysis, ethics and reporting requirements." },
  data: { label: "Data & analysis", purpose: "Profile data and prepare reviewable analysis outputs." },
  writing: { label: "Manuscript assembly", purpose: "Draft sections from approved evidence, methods and results." },
  quality: { label: "Scientific quality control", purpose: "Check claims, citations, calculations and completeness." },
  "peer-review": { label: "Peer-review simulation", purpose: "Stress-test the draft and organize actionable revisions." },
  publication: { label: "Publication preparation", purpose: "Prepare a journal-aware, owner-reviewable submission package." },
  revision: { label: "Revisions & response", purpose: "Track reviewer comments and point-by-point responses." }
};

const PLAN_ROUTES: Record<ResearchEntryPath, ResearchPlanStationId[]> = {
  idea: ["intake", "protocol", "literature", "evidence", "methods", "data", "writing", "quality", "publication"],
  literature: ["literature", "evidence", "protocol", "methods", "writing", "quality", "publication"],
  dataset: ["data", "protocol", "methods", "literature", "evidence", "writing", "quality", "publication"],
  review: ["protocol", "literature", "evidence", "methods", "writing", "quality", "publication"],
  manuscript: ["writing", "evidence", "methods", "data", "quality", "peer-review", "publication", "revision"]
};

const PLAN_TASKS: Partial<Record<ResearchPaperType, Partial<Record<ResearchPlanStationId, [string, string][]>>>> = {
  "empirical-study": {
    intake: [["Define the research problem", "Describe the problem, context and why it matters."], ["Refine the research question", "Make the population, concepts and intended contribution clear."]],
    protocol: [["Choose and justify the study design", "Compare suitable designs and record the researcher's rationale."], ["Define population, setting and outcomes", "Specify eligibility, variables and outcome measures."], ["Plan sampling and sample size", "Document assumptions and how the sample will be obtained."]],
    literature: [["Search for relevant studies", "Record databases, search terms, dates and limits."]],
    evidence: [["Assess evidence for key claims", "Link exact source passages and record the researcher's assessment."]],
    methods: [["Document the analysis plan", "Specify outcomes, candidate methods, assumptions and limitations."], ["Review ethics and reporting requirements", "Identify approvals and study-specific reporting items; do not imply certification."]],
    data: [["Profile and clean the dataset", "Record variables, missingness, transformations and data quality decisions."], ["Run and inspect the planned analysis", "Retain scripts, environment, parameters, logs and actual outputs."]],
    writing: [["Draft methods and results", "Use approved protocol details and verified analysis outputs."], ["Draft introduction and discussion", "Connect the research gap and interpretation to traceable evidence."]]
  },
  "systematic-review": {
    protocol: [["Define the review question", "Specify population, concept/intervention, context and outcomes as appropriate."], ["Set eligibility criteria", "Write inclusion and exclusion criteria before screening."], ["Register and approve the protocol", "Record registration status and owner decision; never claim registration without evidence."]],
    literature: [["Build and run database searches", "Record each database, exact search string, date and limits."], ["Export and deduplicate records", "Preserve source counts and researcher-reviewed duplicate decisions."]],
    evidence: [["Screen titles and abstracts", "Record independent decisions and reasons for exclusions."], ["Review full texts", "Record retrieval status and reason for each exclusion."], ["Extract and assess study evidence", "Keep extraction corrections and risk-of-bias judgements researcher-controlled."], ["Synthesize the evidence", "Document synthesis approach, heterogeneity and certainty limitations."]],
    methods: [["Define synthesis methods", "Specify narrative or quantitative synthesis and planned subgroup analyses."]],
    writing: [["Prepare the PRISMA-aligned review", "Draft methods, results, flow information and limitations from verified records."]]
  },
  "scoping-review": {
    protocol: [["Define the mapping question", "Clarify concepts, population and context to be mapped."], ["Set charting and eligibility rules", "Define inclusion, exclusion and data-charting fields."]],
    literature: [["Build and run the search", "Record sources, search strings, dates and limits."]],
    evidence: [["Screen and chart sources", "Retain researcher decisions and charted source locations."], ["Map concepts and evidence gaps", "Summarize distributions and gaps without overstating effectiveness." ]],
    writing: [["Prepare the PRISMA-ScR manuscript", "Explain the mapping approach, charted results and limitations."]]
  },
  "case-report": {
    intake: [["Define the educational contribution", "Explain what makes the case instructive without exposing identity." ]],
    protocol: [["Confirm consent and permissions", "Record the required consent process and approvals; do not infer they exist."], ["Plan de-identification", "Remove identifying details and assess re-identification risk."]],
    literature: [["Search comparable case literature", "Document the clinical/scientific context and relevant precedents."]],
    evidence: [["Verify case facts against records", "Check dates, measurements and source records while preserving confidentiality."]],
    methods: [["Build the case timeline", "Organize presentation, interventions and follow-up with verified dates."]],
    writing: [["Draft the CARE-aligned case report", "Use a structured case narrative and disclose limitations."]]
  },
  "conference-paper": {
    intake: [["State the conference contribution", "Describe the specific contribution and audience." ]],
    protocol: [["Check conference requirements", "Record word limits, format, track and submission rules from the official call."], ["Create a focused paper outline", "Limit scope to the central contribution and supporting evidence."]],
    literature: [["Select the most relevant sources", "Document the search and prioritize sources directly relevant to the contribution."]],
    evidence: [["Verify central claims", "Link each substantive claim to source evidence or analysis outputs."]],
    writing: [["Draft the conference manuscript", "Write to the verified format and word targets."]]
  },
  "research-protocol": {
    intake: [["Clarify the planned study question", "Describe the problem and the knowledge gap." ]],
    protocol: [["Specify the study design", "Document setting, population, eligibility, sampling and procedures."], ["Define outcomes and analysis", "Specify primary/secondary outcomes and planned analyses."], ["Prepare ethics and registration plan", "Identify required approvals and registration steps without claiming completion."]],
    literature: [["Justify the research gap", "Find and organize evidence supporting the rationale."]],
    writing: [["Draft the protocol manuscript", "Present planned methods in future tense and distinguish planned from completed work."]]
  },
  "dataset-analysis": {
    data: [["Inspect dataset structure", "Profile variables, types, ranges, missingness and duplicates without modifying raw data."], ["Create a data dictionary", "Define variables, units, coding and provenance."], ["Document data quality decisions", "Record exclusions, transformations and assumptions before analysis."]],
    protocol: [["Develop a researchable question", "Formulate candidate questions that the available data can legitimately answer."], ["Select a candidate study design", "Describe the design and important limitations of the dataset."], ["Agree an analysis plan", "Record the researcher's chosen outcomes, methods and assumptions."]],
    methods: [["Review bias, privacy and ethics", "Assess selection, measurement, missing-data and governance considerations."]],
    literature: [["Contextualize the question", "Find evidence to explain why the question matters."]],
    writing: [["Draft results from actual outputs", "Do not invent results or describe unexecuted analyses as completed."]]
  },
  "existing-manuscript": {
    writing: [["Inventory manuscript sections", "Identify present, missing and incomplete sections."], ["Import and inspect references", "Check bibliographic completeness and citation keys."]],
    evidence: [["Map claims to source passages", "Identify unsupported, conflicting and awaiting-verification claims."]],
    methods: [["Review methods transparency", "Check design, population, outcomes, analysis and ethics reporting."], ["Map reporting checklist items", "Record missing declarations separately from verified facts."]],
    quality: [["Create a prioritized revision list", "Link each issue to a manuscript location and supporting evidence."]]
  }
};

function routeForResearchPlan(paperType: ResearchPaperType, entryPath: ResearchEntryPath): ResearchPlanStationId[] {
  if (entryPath !== "idea") return [...PLAN_ROUTES[entryPath]];
  if (paperType === "systematic-review" || paperType === "scoping-review") return [...PLAN_ROUTES.review];
  if (paperType === "dataset-analysis") return [...PLAN_ROUTES.dataset];
  if (paperType === "existing-manuscript") return [...PLAN_ROUTES.manuscript];
  if (paperType === "research-protocol") return ["intake", "protocol", "literature", "methods", "writing", "quality", "publication"];
  return [...PLAN_ROUTES.idea];
}

function planMilestoneTitles(paperType: ResearchPaperType): string[] {
  if (paperType === "systematic-review" || paperType === "scoping-review") return ["Review question and protocol confirmed", "Search and screening completed", "Evidence synthesis reviewed", "Manuscript and reporting checklist reviewed"];
  if (paperType === "case-report") return ["Consent and de-identification checks completed", "Case timeline verified", "Draft and CARE checklist reviewed"];
  if (paperType === "dataset-analysis") return ["Dataset profile and data dictionary reviewed", "Analysis plan approved by researcher", "Reproducible outputs reviewed", "Manuscript draft reviewed"];
  if (paperType === "research-protocol") return ["Research question and design confirmed", "Protocol and analysis plan reviewed", "Ethics and registration requirements checked"];
  if (paperType === "conference-paper") return ["Conference requirements checked", "Contribution and evidence reviewed", "Submission draft reviewed"];
  if (paperType === "existing-manuscript") return ["Manuscript inventory completed", "Evidence and methods gaps reviewed", "Revision package reviewed"];
  return ["Research question and plan confirmed", "Evidence and methods reviewed", "Analysis outputs reviewed", "Manuscript and quality checks reviewed"];
}

const planId = () => globalThis.crypto?.randomUUID?.() ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function createResearchStationPlan(paperType: ResearchPaperType, entryPath: ResearchEntryPath = "idea", now = Date.now()): ResearchStationPlan {
  const route = routeForResearchPlan(paperType, entryPath);
  const tasks = PLAN_TASKS[paperType] ?? {};
  const stations = route.map(stationId => {
    const details = PLAN_STATION_DETAILS[stationId];
    const defaults = tasks[stationId] ?? [[
      stationId === "publication" ? "Prepare the publication package" : `Review ${details.label.toLowerCase()}`,
      stationId === "publication" ? "Check target requirements and prepare files for owner review." : details.purpose
    ] as [string, string]];
    return {
      stationId,
      ...details,
      tasks: defaults.map(([title, description]) => ({ id: planId(), stationId, title, description, completed: false, origin: "blueprint" as const }))
    };
  });
  return {
    schemaVersion: 1,
    paperType,
    entryPath,
    stations,
    milestones: planMilestoneTitles(paperType).map(title => ({ id: planId(), title, completed: false })),
    updatedAt: now
  };
}

export function updateResearchPlanTask(plan: ResearchStationPlan, taskId: string, patch: Partial<Pick<ResearchPlanTask, "title" | "description" | "completed">>, now = Date.now()): ResearchStationPlan {
  let found = false;
  const stations = plan.stations.map(station => ({
    ...station,
    tasks: station.tasks.map(task => {
      if (task.id !== taskId) return task;
      found = true;
      const title = patch.title === undefined ? task.title : patch.title.trim();
      if (!title) throw new Error("Task title is required.");
      return { ...task, ...patch, title };
    })
  }));
  if (!found) throw new Error("Research plan task was not found.");
  return { ...plan, stations, updatedAt: now };
}

export function addResearchPlanTask(plan: ResearchStationPlan, stationId: ResearchPlanStationId, title: string, description = "", now = Date.now(), id = planId()): ResearchStationPlan {
  if (!title.trim()) throw new Error("Task title is required.");
  const stationExists = plan.stations.some(station => station.stationId === stationId);
  if (!stationExists) throw new Error("Choose a station in this research plan.");
  return {
    ...plan,
    stations: plan.stations.map(station => station.stationId === stationId
      ? { ...station, tasks: [...station.tasks, { id, stationId, title: title.trim(), description: description.trim(), completed: false, origin: "researcher" as const }] }
      : station),
    updatedAt: now
  };
}

export function addResearchPlanMilestone(plan: ResearchStationPlan, title: string, dueDate?: string, now = Date.now(), id = planId()): ResearchStationPlan {
  if (!title.trim()) throw new Error("Milestone title is required.");
  return { ...plan, milestones: [...plan.milestones, { id, title: title.trim(), ...(dueDate ? { dueDate } : {}), completed: false }], updatedAt: now };
}

export function updateResearchPlanMilestone(plan: ResearchStationPlan, milestoneId: string, patch: Partial<Pick<ResearchPlanMilestone, "title" | "dueDate" | "completed">>, now = Date.now()): ResearchStationPlan {
  let found = false;
  const milestones = plan.milestones.map(milestone => {
    if (milestone.id !== milestoneId) return milestone;
    found = true;
    const title = patch.title === undefined ? milestone.title : patch.title.trim();
    if (!title) throw new Error("Milestone title is required.");
    return { ...milestone, ...patch, title };
  });
  if (!found) throw new Error("Research plan milestone was not found.");
  return { ...plan, milestones, updatedAt: now };
}

export function removeResearchPlanTask(plan: ResearchStationPlan, taskId: string, now = Date.now()): ResearchStationPlan {
  const stations = plan.stations.map(station => ({ ...station, tasks: station.tasks.filter(task => task.id !== taskId) }));
  if (stations.every((station, index) => station.tasks.length === plan.stations[index].tasks.length)) throw new Error("Research plan task was not found.");
  return { ...plan, stations, updatedAt: now };
}


export function moveResearchPlanStation(plan: ResearchStationPlan, fromIndex: number, toIndex: number, now = Date.now()): ResearchStationPlan {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= plan.stations.length || toIndex >= plan.stations.length) {
    throw new Error("Choose a valid station position.");
  }
  if (fromIndex === toIndex) return plan;
  const stations = [...plan.stations];
  const [station] = stations.splice(fromIndex, 1);
  stations.splice(toIndex, 0, station);
  return { ...plan, stations, updatedAt: now };
}
