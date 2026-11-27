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

const MAX_DESCRIPTIVE_SUMMARY_ROWS = 5000;
const MAX_PUBLICATION_FIGURE_BARS = 40;

export interface DescriptiveAnalysisInput {
  datasetName: string;
  headers: string[];
  rows: string[][];
  outcomeColumn: string;
  groupColumn?: string;
  outcomeType: StatisticalPlanningInput["outcomeType"];
  truncated?: boolean;
}

export interface DescriptiveAnalysisFigure {
  title: string;
  xLabel: string;
  yLabel: string;
  categories: string[];
  values: number[];
}

export interface DescriptiveAnalysisResult {
  engineVersion: string;
  method: string;
  datasetName: string;
  rowCountAnalyzed: number;
  outcomeColumn: string;
  groupColumn: string;
  outcomeType: StatisticalPlanningInput["outcomeType"];
  table: { columns: string[]; rows: Array<Record<string, string | number>> };
  figure: DescriptiveAnalysisFigure;
  caption: string;
  logs: string[];
}

const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function executeDescriptiveAnalysis(input: DescriptiveAnalysisInput): DescriptiveAnalysisResult {
  if (input.truncated) throw new Error("The dataset is truncated for preview. Run analysis only after loading the complete dataset.");
  if (input.outcomeType === "time-to-event") throw new Error("Time-to-event inference is not supported by this descriptive runner. Use a validated survival-analysis workflow.");
  if (!input.rows.length) throw new Error("The selected dataset contains no data rows.");
  const outcomeIndex = input.headers.indexOf(input.outcomeColumn);
  if (outcomeIndex < 0) throw new Error("Choose an outcome column that exists in the dataset.");
  const groupIndex = input.groupColumn ? input.headers.indexOf(input.groupColumn) : -1;
  if (input.groupColumn && groupIndex < 0) throw new Error("Choose a grouping column that exists in the dataset.");
  if (groupIndex === outcomeIndex) throw new Error("The outcome and grouping columns must be different.");
  const grouped = new Map<string, string[][]>();
  for (const row of input.rows) {
    const group = groupIndex >= 0 ? (row[groupIndex] ?? "").trim() || "(Missing group)" : "All records";
    const existing = grouped.get(group) ?? [];
    existing.push(row);
    grouped.set(group, existing);
  }
  const groupNames = [...grouped.keys()].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const logs = [
    "Engine: PaperOrchestra descriptive-analysis@1.0.0",
    "Runtime: deterministic browser JavaScript",
    "Dataset: " + input.datasetName,
    "Rows analyzed: " + input.rows.length,
    "Outcome: " + input.outcomeColumn + " (" + input.outcomeType + ")",
    "Grouping: " + (input.groupColumn || "none"),
    "Scope: descriptive summaries only; no inferential test or causal estimate was run."
  ];

  if (input.outcomeType === "continuous" || input.outcomeType === "count") {
    const tableRows: Array<Record<string, string | number>> = [];
    const figureCategories: string[] = [];
    const figureValues: number[] = [];
    for (const group of groupNames) {
      const rows = grouped.get(group)!;
      const observed = rows.map(row => (row[outcomeIndex] ?? "").trim()).filter(Boolean).map(Number).filter(Number.isFinite);
      const missing = rows.length - observed.length;
      if (!observed.length) {
        tableRows.push({ group, n: 0, missing, mean: "", sd: "", median: "", min: "", max: "" });
        continue;
      }
      const mean = observed.reduce((sum, value) => sum + value, 0) / observed.length;
      const variance = observed.length > 1 ? observed.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (observed.length - 1) : 0;
      const sd = Math.sqrt(variance);
      tableRows.push({
        group, n: observed.length, missing,
        mean: Number(mean.toFixed(4)), sd: observed.length > 1 ? Number(sd.toFixed(4)) : "",
        median: Number(medianOf(observed).toFixed(4)),
        min: observed.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY), max: observed.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY)
      });
      figureCategories.push(group);
      figureValues.push(Number(mean.toFixed(4)));
    }
    if (!figureValues.length) throw new Error("No valid numeric values were found in the selected outcome column.");
    if (tableRows.length > MAX_DESCRIPTIVE_SUMMARY_ROWS) throw new Error("This analysis creates more than 5,000 group summaries. Reduce the number of groups or refine the dataset before running it.");
    const figureOrder = figureValues.map((_, index) => index).sort((a, b) => figureValues[b] - figureValues[a]).slice(0, MAX_PUBLICATION_FIGURE_BARS);
    const method = "Grouped descriptive summary";
    return {
      engineVersion: "descriptive-analysis@1.0.0", method, datasetName: input.datasetName,
      rowCountAnalyzed: input.rows.length, outcomeColumn: input.outcomeColumn,
      groupColumn: input.groupColumn ?? "", outcomeType: input.outcomeType,
      table: { columns: ["Group", "N", "Missing", "Mean", "SD", "Median", "Minimum", "Maximum"], rows: tableRows },
      figure: { title: "Mean " + input.outcomeColumn + " by " + (input.groupColumn || "dataset") + (figureValues.length > MAX_PUBLICATION_FIGURE_BARS ? " (top 40 of " + figureValues.length + ")" : ""), xLabel: input.groupColumn || "Dataset", yLabel: "Mean " + input.outcomeColumn, categories: figureOrder.map(index => figureCategories[index]), values: figureOrder.map(index => figureValues[index]) },
      caption: "Descriptive mean and sample standard deviation of " + input.outcomeColumn + (input.groupColumn ? " by " + input.groupColumn : "") + " in " + input.datasetName + ". " + input.rows.length + " rows were analyzed; missing outcome values are reported separately.",
      logs
    };
  }

  const tableRows: Array<Record<string, string | number>> = [];
  const figureCategories: string[] = [];
  const figureValues: number[] = [];
  for (const group of groupNames) {
    const rows = grouped.get(group)!;
    const values = rows.map(row => (row[outcomeIndex] ?? "").trim()).filter(Boolean);
    const missing = rows.length - values.length;
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    for (const category of [...counts.keys()].sort((a, b) => a < b ? -1 : a > b ? 1 : 0)) {
      const count = counts.get(category)!;
      const percent = values.length ? Number((count / values.length * 100).toFixed(2)) : 0;
      tableRows.push({ group, category, count, percent, denominator: values.length, missing });
      figureCategories.push((input.groupColumn ? group + " · " : "") + category);
      figureValues.push(count);
    }
    if (!values.length) tableRows.push({ group, category: "(No observed values)", count: 0, percent: 0, denominator: 0, missing });
  }
  if (!figureValues.length) throw new Error("No observed categories were found in the selected outcome column.");
  if (tableRows.length > MAX_DESCRIPTIVE_SUMMARY_ROWS) throw new Error("This analysis creates more than 5,000 category summaries. Refine the dataset or select a lower-cardinality outcome before running it.");
  const figureOrder = figureValues.map((_, index) => index).sort((a, b) => figureValues[b] - figureValues[a]).slice(0, MAX_PUBLICATION_FIGURE_BARS);
  const method = "Grouped categorical frequency summary";
  return {
    engineVersion: "descriptive-analysis@1.0.0", method, datasetName: input.datasetName,
    rowCountAnalyzed: input.rows.length, outcomeColumn: input.outcomeColumn,
    groupColumn: input.groupColumn ?? "", outcomeType: input.outcomeType,
    table: { columns: ["Group", "Category", "Count", "Percent", "Denominator", "Missing"], rows: tableRows },
    figure: { title: "Frequency of " + input.outcomeColumn + (figureValues.length > MAX_PUBLICATION_FIGURE_BARS ? " (top 40 of " + figureValues.length + ")" : ""), xLabel: input.groupColumn ? input.groupColumn + " · " + input.outcomeColumn : input.outcomeColumn, yLabel: "Count", categories: figureOrder.map(index => figureCategories[index]), values: figureOrder.map(index => figureValues[index]) },
    caption: "Observed frequency and within-group percentage of " + input.outcomeColumn + (input.groupColumn ? " by " + input.groupColumn : "") + " in " + input.datasetName + ". Percentages use non-missing outcome values as the denominator.",
    logs
  };
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]!));
}

export function renderAnalysisFigureSvg(figure: DescriptiveAnalysisFigure): string {
  const width = 1200, height = 720, left = 110, right = 45, top = 92, bottom = 150;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const maximum = Math.max(1, figure.values.reduce((value, item) => Math.max(value, item), 0));
  const step = maximum / 4;
  const band = plotWidth / Math.max(1, figure.values.length);
  const barWidth = Math.min(72, band * .58);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = maximum - step * index;
    const y = top + plotHeight * index / 4;
    return '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '" stroke="#d8dce2" stroke-width="1"/><text x="' + (left - 14) + '" y="' + (y + 5) + '" text-anchor="end" font-size="16" fill="#344054">' + value.toFixed(1) + '</text>';
  }).join("");
  const bars = figure.values.map((value, index) => {
    const x = left + band * index + (band - barWidth) / 2;
    const barHeight = value / maximum * plotHeight;
    const y = top + plotHeight - barHeight;
    const label = figure.categories[index] ?? "";
    const labelX = left + band * (index + .5);
    return '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" rx="5" fill="#155d6b"/><text x="' + labelX + '" y="' + (y - 12) + '" text-anchor="middle" font-size="15" fill="#172d31">' + value.toFixed(2) + '</text><text x="' + labelX + '" y="' + (height - bottom + 30) + '" text-anchor="middle" font-size="14" fill="#344054">' + escapeSvg(label.slice(0, 28)) + '</text>';
  }).join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + escapeSvg(figure.title) + '" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect width="100%" height="100%" fill="#ffffff"/><text x="' + left + '" y="45" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#172d31">' + escapeSvg(figure.title) + '</text>' + grid + bars + '<text x="' + (width / 2) + '" y="' + (height - 35) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#172d31">' + escapeSvg(figure.xLabel) + '</text><text transform="translate(28 ' + (height / 2) + ') rotate(-90)" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#172d31">' + escapeSvg(figure.yLabel) + '</text></svg>';
}

export interface AnalysisRunManifest {
  datasetId: string;
  datasetFingerprint: string;
  transformations: string[];
  script: string;
  software: Record<string, string>;
  parameters: Record<string, string | number | boolean | null>;
  outputIds: string[];
  researcherNotes?: string;
  execution?: { status: "completed" | "failed"; startedAt: number; completedAt: number; durationMs: number; runtime: string; analyzedRows: number; logs: string[] };
  ownerApproved: boolean;
  status: "awaiting-owner-review" | "approved";
  createdAt: number;
  approvedAt?: number;
}

export function createAnalysisRunManifest(input: { datasetId: string; datasetFingerprint: string; transformations: string[]; script: string; software: Record<string, string>; parameters: Record<string, string | number | boolean | null>; outputIds: string[]; researcherNotes?: string; execution?: { status: "completed" | "failed"; startedAt: number; completedAt: number; durationMs: number; runtime: string; analyzedRows: number; logs: string[] }; }): AnalysisRunManifest {
  if (!input.datasetId.trim() || !input.datasetFingerprint.trim()) throw new Error("A dataset ID and immutable dataset fingerprint are required.");
  if (!input.script.trim()) throw new Error("A reproducible analysis script or documented procedure is required.");
  return { datasetId: input.datasetId, datasetFingerprint: input.datasetFingerprint, transformations: [...input.transformations], script: input.script, software: { ...input.software }, parameters: { ...input.parameters }, outputIds: [...input.outputIds], ...(input.researcherNotes?.trim() ? { researcherNotes: input.researcherNotes.trim() } : {}), ...(input.execution ? { execution: { ...input.execution, logs: [...input.execution.logs] } } : {}), ownerApproved: false as const, status: "awaiting-owner-review" as const, createdAt: Date.now() };
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
export function approveAnalysisRunManifest(manifest: AnalysisRunManifest, approvedAt = Date.now()): AnalysisRunManifest {
  return { ...manifest, ownerApproved: true, status: "approved", approvedAt };
}

function escapeLatexCell(value: unknown) {
  const replacements: Record<string, string> = {
    "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$",
    "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}"
  };
  return String(value ?? "").replace(/[\\\\&%$#_{}~^]/g, character => replacements[character] ?? character);
}

export function renderAnalysisTableLatex(table: DescriptiveAnalysisResult["table"], caption: string): string {
  const alignment = "l" + "r".repeat(Math.max(0, table.columns.length - 1));
  const header = table.columns.map(escapeLatexCell).join(" & ") + " \\\\";
  const rows = table.rows.map(row => Object.values(row).map(escapeLatexCell).join(" & ") + " \\\\");
  return [
    "\\begin{table}[htbp]",
    "\\centering",
    "\\caption{" + escapeLatexCell(caption) + "}",
    "\\begin{tabular}{" + alignment + "}",
    "\\hline",
    header,
    "\\hline",
    ...rows,
    "\\hline",
    "\\end{tabular}",
    "\\end{table}"
  ].join("\n");
}
