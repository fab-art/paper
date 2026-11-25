import type { ResearchPaperType } from "./research-blueprint";

export interface StatisticalPlanningInput { studyDesign: string; outcomeType: "continuous" | "binary" | "categorical" | "count" | "time-to-event" | "ordinal"; groups: number; paired: boolean; sampleSize: number; }
export interface StatisticalOption { method: string; rationale: string; assumptions: string[]; limitations: string[]; }

export function recommendStatisticalOptions(input: StatisticalPlanningInput) {
  const design = input.studyDesign.trim().toLowerCase();
  const options: StatisticalOption[] = [];
  const assumptions = ["Confirm the research question, estimand, sampling process and unit of analysis.", "Inspect missingness, outliers, measurement validity and data independence.", "Check method-specific assumptions using appropriate diagnostics before interpretation."];
  if (input.outcomeType === "binary") {
    options.push({ method: "Logistic regression", rationale: "Candidate model for a binary outcome when design and covariates support adjusted estimation.", assumptions: ["Independent observations unless clustering is modelled", "Adequate outcome events for model complexity", "Appropriate functional form for continuous predictors"], limitations: ["Cross-sectional odds ratios are not risk ratios", "Sparse events and separation can make estimates unstable"] });
    if (design.includes("randomized") && input.groups === 2) options.push({ method: "Risk difference / risk ratio with confidence intervals", rationale: "Transparent primary comparison for a two-arm trial with a binary endpoint.", assumptions: ["Prespecified analysis population and denominator", "Follow-up and missing outcome handling are defined"], limitations: ["Do not select the estimand after inspecting results"] });
  } else if (input.outcomeType === "continuous") {
    if (input.groups === 2) options.push({ method: input.paired ? "Paired t-test" : "Independent-samples t-test (Welch)", rationale: input.paired ? "Compares within-unit changes for paired measurements." : "Compares two independent group means while allowing unequal variances.", assumptions: [input.paired ? "Pairs are correctly matched and independent of other pairs" : "Groups are independent", "Residuals/differences are sufficiently well behaved for the sample size"], limitations: ["Use robust or non-parametric alternatives when diagnostics indicate serious violations"] });
    else options.push({ method: "Linear regression / ANOVA", rationale: "Candidate for comparing a continuous outcome across multiple groups, with justified covariate adjustment.", assumptions: ["Independent errors or a model for clustering/repeated measures", "Residual diagnostics and variance structure are assessed"], limitations: ["Multiple comparisons require a prespecified strategy"] });
  } else if (input.outcomeType === "count") options.push({ method: "Poisson or negative-binomial regression", rationale: "Candidate count-outcome models; choose based on data-generating process and dispersion diagnostics.", assumptions: ["Exposure time/denominators are modelled where needed", "Mean-variance relationship is assessed"], limitations: ["Overdispersion can invalidate simple Poisson standard errors"] });
  else if (input.outcomeType === "time-to-event") options.push({ method: "Kaplan–Meier and Cox regression", rationale: "Candidate time-to-event methods when censoring and proportional-hazards assumptions are appropriate.", assumptions: ["Censoring mechanism is defensible", "Proportional hazards checked for Cox models"], limitations: ["Competing risks may require another framework"] });
  else options.push({ method: "Ordinal or multinomial regression (design-dependent)", rationale: "Candidate models for ordered or nominal categorical outcomes.", assumptions: ["Outcome ordering is justified for ordinal models", "Model fit and sparse categories are assessed"], limitations: ["Do not collapse categories without documented rationale"] });
  if (input.sampleSize > 0 && input.sampleSize < 30) assumptions.push("Small sample: emphasize uncertainty and check whether asymptotic approximations are credible.");
  if (design.includes("cluster") || design.includes("cohort")) assumptions.push("Check clustering, repeated observations, follow-up time and confounding structure explicitly.");
  return { options, assumptions, requiresOwnerApproval: true as const, status: "recommendation-only" as const };
}

export function createAnalysisRunManifest(input: { datasetId: string; datasetFingerprint: string; transformations: string[]; script: string; software: Record<string, string>; parameters: Record<string, string | number | boolean | null>; outputIds: string[]; }) {
  if (!input.datasetId.trim() || !input.datasetFingerprint.trim()) throw new Error("A dataset ID and immutable dataset fingerprint are required.");
  if (!input.script.trim()) throw new Error("A reproducible analysis script or documented procedure is required.");
  return { datasetId: input.datasetId, datasetFingerprint: input.datasetFingerprint, transformations: [...input.transformations], script: input.script, software: { ...input.software }, parameters: { ...input.parameters }, outputIds: [...input.outputIds], ownerApproved: false as const, status: "awaiting-owner-review" as const, createdAt: Date.now() };
}

export function getStudyComplianceChecklist(paperType: ResearchPaperType | undefined, studyDesign: string) {
  const design = studyDesign.toLowerCase();
  let guideline = "";
  if (paperType === "systematic-review") guideline = "PRISMA";
  else if (paperType === "scoping-review") guideline = "PRISMA-ScR";
  else if (paperType === "case-report" || design.includes("case report")) guideline = "CARE";
  else if (design.includes("randomized") || design.includes("clinical trial")) guideline = "CONSORT";
  else if (["cohort", "case-control", "cross-sectional", "observational"].some(term => design.includes(term))) guideline = "STROBE";
  const items = [...(guideline ? [{ id: "reporting-guideline", guideline, label: "Check the applicable " + guideline + " reporting items." }] : []),
    { id: "ethics", guideline: "Ethics", label: "Record ethics approval, exemption or waiver details where applicable." },
    { id: "consent", guideline: "Consent", label: "Document consent, assent and permissions where applicable." },
    { id: "registration", guideline: "Registration", label: "Check whether prospective study or review registration is required." },
    { id: "data-availability", guideline: "Transparency", label: "Prepare a data availability and privacy statement." },
    { id: "funding-conflicts", guideline: "Transparency", label: "Declare funding and conflicts of interest accurately." },
    { id: "author-contributions", guideline: "Authorship", label: "Confirm author contributions and affiliations with all authors." },
    { id: "ai-disclosure", guideline: "Disclosure", label: "Check whether AI-use disclosure is required by the target journal or institution." }];
  return items.map(item => ({ ...item, confirmed: false as const, status: "not-confirmed" as const }));
}