import { normalizeDoi, normalizePaperTitle } from "./literature-discovery.mjs";

export const APPRAISAL_TEMPLATES = Object.freeze({
  "RoB 2 (randomized trials)": [
    ["randomization", "Bias arising from the randomization process", "Consider sequence generation, allocation concealment and baseline differences."],
    ["deviations", "Bias due to deviations from intended interventions", "Consider blinding, deviations from assigned intervention and analysis effects."],
    ["missing-data", "Bias due to missing outcome data", "Consider missingness amount, reasons and whether missingness could depend on the true outcome."],
    ["outcome-measurement", "Bias in measurement of the outcome", "Consider measurement validity, blinding and whether methods differed between groups."],
    ["reported-result", "Bias in selection of the reported result", "Compare reported outcomes and analyses with prespecified plans where available."]
  ],
  "ROBINS-I (non-randomized interventions)": [
    ["confounding", "Bias due to confounding", "Identify important prognostic factors and whether design or analysis addressed them."],
    ["selection", "Bias in selection of participants", "Consider selection into the study and exclusion after intervention assignment."],
    ["classification", "Bias in classification of interventions", "Consider whether intervention groups were defined accurately at the start of follow-up."],
    ["deviations", "Bias due to deviations from intended interventions", "Consider co-interventions, adherence and analysis approach."],
    ["missing-data", "Bias due to missing data", "Consider extent, reasons and handling of missing data."],
    ["outcome-measurement", "Bias in measurement of outcomes", "Consider validity, reliability and differential measurement between groups."],
    ["reported-result", "Bias in selection of the reported result", "Consider selective reporting of outcomes, analyses or subgroups."]
  ],
  "JBI analytical cross-sectional": [
    ["inclusion", "Inclusion criteria clearly defined", "Check whether eligibility criteria are explicit and appropriate."],
    ["subjects", "Study subjects and setting described in detail", "Check population, recruitment, setting and participant characteristics."],
    ["exposure", "Exposure measured validly and reliably", "Check measurement methods and evidence of validity or reliability."],
    ["criteria", "Objective, standard criteria used", "Check whether objective criteria were used for the condition or outcome."],
    ["confounding", "Confounding factors identified", "Identify plausible confounders relevant to the research question."],
    ["strategies", "Strategies to deal with confounding stated", "Check design and analysis strategies used to address confounding."],
    ["outcome", "Outcomes measured validly and reliably", "Check outcome definitions, instruments and measurement consistency."],
    ["analysis", "Appropriate statistical analysis", "Check whether methods match design, data structure and assumptions."]
  ],
  "CASP qualitative prompts": [
    ["aims", "Clear statement of research aims", "Consider whether the purpose and research question are explicit."],
    ["methodology", "Qualitative methodology appropriate", "Consider fit between the research question and qualitative approach."],
    ["design", "Research design appropriate", "Consider whether the design addresses the stated aims."],
    ["recruitment", "Recruitment strategy appropriate", "Consider participant selection and justification."],
    ["collection", "Data collection appropriate", "Consider detail, context and adequacy of data collection."],
    ["reflexivity", "Researcher-participant relationship considered", "Consider reflexivity and researcher influence."],
    ["ethics", "Ethical issues considered", "Consider approval, consent, confidentiality and participant welfare."],
    ["analysis", "Data analysis sufficiently rigorous", "Consider transparency, coding and interpretation."],
    ["findings", "Clear statement of findings", "Consider whether findings are supported by data."],
    ["value", "Value of the research", "Consider contribution, transferability and implications."]
  ]
});

export function evidencePaperKey(paper) {
  const doi = normalizeDoi(paper?.doi);
  if (doi) return "doi:" + doi;
  const title = String(paper?.title ?? "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[^\\p{L}\\p{N}]+/gu, " ").trim();
  if (title) return "title:" + title;
  const rawUrl = String(paper?.url ?? "").trim();
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    return "url:" + (url.origin + url.pathname).replace(/\\/+$/, "").toLowerCase();
  } catch {
    return "url:" + rawUrl.toLowerCase().replace(/[?#].*$/, "").replace(/\\/+$/, "");
  }
}

export function createAppraisalRecord(paper, tool = "RoB 2 (randomized trials)") {
  const template = APPRAISAL_TEMPLATES[tool] ?? APPRAISAL_TEMPLATES["RoB 2 (randomized trials)"];
  return {
    tool,
    domains: template.map(([id, name, guidance]) => ({
      id, name, guidance, judgement: "not-assessed", rationale: "", evidenceQuote: "", sourceLocation: ""
    }))
  };
}

export function createExtractionRecord() {
  return {
    studyDesign: "", setting: "", population: "", sampleSize: "", intervention: "",
    comparator: "", outcomes: "", effectEstimate: "", limitations: "", funding: "",
    sourceLocation: "", supportingQuote: ""
  };
}

export function upsertEvidenceRecord(reviewData, paper, changes = {}, updatedAt = Date.now()) {
  const key = evidencePaperKey(paper);
  if (!key) throw new Error("A paper needs a DOI or title before it can be appraised.");
  const current = reviewData ?? {
    protocol: {
      reviewType: "other", population: "", intervention: "", comparator: "", outcomes: "",
      studyDesign: "", databases: [], searchDate: "", startDate: "", endDate: "",
      inclusionCriteria: "", exclusionCriteria: "", registrationUrl: ""
    },
    screening: {}, extraction: {}, riskOfBias: {}
  };
  const previousExtraction = current.extraction?.[key] ?? createExtractionRecord();
  const previousAppraisal = current.riskOfBias?.[key] ?? createAppraisalRecord(paper);
  const next = {
    ...current,
    extraction: {
      ...(current.extraction ?? {}),
      ...(changes.extraction ? { [key]: { ...previousExtraction, ...changes.extraction } } : {})
    },
    riskOfBias: {
      ...(current.riskOfBias ?? {}),
      ...(changes.riskOfBias ? { [key]: { ...previousAppraisal, ...changes.riskOfBias } } : {})
    }
  };
  return { key, data: next, updatedAt };
}

export function summarizeAppraisal(record) {
  const domains = record?.domains ?? [];
  const assessed = domains.filter(domain => domain.judgement && domain.judgement !== "not-assessed").length;
  const completed = assessed === domains.length && domains.length > 0;
  return {
    total: domains.length,
    assessed,
    remaining: Math.max(0, domains.length - assessed),
    completed,
    high: domains.filter(domain => domain.judgement === "high" || domain.judgement === "serious" || domain.judgement === "critical").length,
    concerns: domains.filter(domain => domain.judgement === "some-concerns" || domain.judgement === "moderate").length
  };
}

export function validateEvidenceEntry(extraction, appraisal) {
  const errors = [];
  if (!extraction || !Object.values(extraction).some(value => String(value ?? "").trim())) {
    errors.push("Add at least one extracted study detail before saving.");
  }
  if (!appraisal?.tool || !Array.isArray(appraisal.domains) || appraisal.domains.length === 0) {
    errors.push("Choose an appraisal prompt set before saving.");
  }
  for (const domain of appraisal?.domains ?? []) {
    if (domain.judgement !== "not-assessed" && !String(domain.rationale ?? "").trim()) {
      errors.push("Add a rationale for each assessed domain.");
      break;
    }
  }
  return errors;
}


export function switchAppraisalTemplate(current, paper, tool) {
  if (current?.tool === tool) return current;
  const previousTools = { ...(current?.previousTools ?? {}) };
  if (current?.tool) previousTools[current.tool] = current;
  const restored = previousTools[tool];
  if (restored) {
    const next = { ...restored, previousTools: { ...previousTools } };
    delete next.previousTools[tool];
    return next;
  }
  return { ...createAppraisalRecord(paper, tool), previousTools };
}
