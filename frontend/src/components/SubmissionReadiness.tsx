import { useMemo, useState } from "react";
import JSZip from "jszip";
import { AlertCircle, Archive, CheckCircle2, ClipboardCheck, Download, FileText, ShieldCheck, Sparkles } from "lucide-react";
import type { Project, ProjectAttachment, ProjectNote } from "../lib/types";
import "./submission-readiness.css";

type Props = { project: Project; notes: ProjectNote[]; attachments: ProjectAttachment[]; onUpdateProject: (changes: Partial<Project>) => void };
type Finding = { id: string; title: string; detail: string; status: "pass" | "warning" | "action" };
const manualItems = [
  { id: "ethics", label: "Ethics approval or exemption is documented where required." },
  { id: "consent", label: "Participant consent, assent and permissions are addressed where applicable." },
  { id: "authorship", label: "Authorship, affiliations, funding and conflicts of interest are accurate." },
  { id: "data", label: "Data availability, privacy and sharing restrictions are addressed." },
  { id: "reporting", label: "The correct reporting guideline has been selected and followed (e.g. CONSORT, STROBE, PRISMA)." },
  { id: "journal", label: "Target journal or institution instructions, formatting and submission requirements have been checked." }
];
function citationKeys(tex: string) {
  const keys = new Set<string>();
  for (const match of tex.matchAll(/\\cite[a-zA-Z]*\s*\{([^}]+)\}/g)) match[1].split(",").map(value => value.trim()).filter(Boolean).forEach(value => keys.add(value));
  return [...keys];
}
function bibKeys(bib: string) { return [...bib.matchAll(/@[a-zA-Z]+\s*\{\s*([^,\s]+)\s*,/g)].map(match => match[1]); }
function cleanFileName(value: string) { return value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "file"; }
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function reportText(project: Project, findings: Finding[]) {
  const completed = manualItems.filter(item => project.submissionChecks?.[item.id]).length;
  return [
    "# PaperOrchestra — Quality & Submission Report", "",
    "Project: " + project.name, "Generated: " + new Date().toISOString(), "",
    "## Automated checks",
    ...findings.map(item => "- [" + item.status.toUpperCase() + "] " + item.title + ": " + item.detail), "",
    "## Researcher confirmations",
    ...manualItems.map(item => "- [" + (project.submissionChecks?.[item.id] ? "x" : " ") + "] " + item.label), "",
    "Manual confirmations completed: " + completed + "/" + manualItems.length, "",
    "## Important limitations",
    "- Automated checks inspect document structure and project metadata; they do not establish scientific validity, ethical compliance, plagiarism status or journal acceptance.",
    "- Resolve all warnings and action items manually before submission.",
    "- Verify every citation and reference against the original publication.", ""
  ].join("\n");
}

export default function SubmissionReadiness({ project, notes, attachments, onUpdateProject }: Props) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const findings = useMemo<Finding[]>(() => {
    const tex = project.latex || "", bib = project.bibtex || "";
    const title = /\\title\s*\{([^}]*)\}/i.exec(tex)?.[1]?.trim() || "";
    const citations = citationKeys(tex), bibliography = bibKeys(bib), bibSet = new Set(bibliography);
    const missing = citations.filter(key => !bibSet.has(key));
    const uncited = bibliography.filter(key => !citations.includes(key));
    const figureNames = project.figures.map(item => item.name);
    const figureRefs = [...tex.matchAll(/\\includegraphics(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)].map(match => match[1].split("/").pop() || match[1]);
    const missingFigures = figureRefs.filter(name => !figureNames.some(asset => asset === name || asset.endsWith(name)));
    const incompleteSources = project.papers.filter(paper => !paper.doi && !paper.url).length;
    const substantive = tex.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, " ").replace(/[{}\\]/g, " ").trim().length;
    return [
      { id: "title", title: "Manuscript title", detail: title ? "A title is present in the LaTeX source." : "Add a manuscript title using \\title{...}.", status: title ? "pass" : "action" },
      { id: "question", title: "Research question", detail: project.researchQuestion?.trim() ? "Research question is recorded in the project brief." : "Add the research question to the project overview.", status: project.researchQuestion?.trim() ? "pass" : "warning" },
      { id: "objectives", title: "Research objectives", detail: project.objectives?.length ? project.objectives.length + " objective(s) recorded." : "No research objectives are recorded.", status: project.objectives?.length ? "pass" : "warning" },
      { id: "methods", title: "Methodology", detail: project.methodology?.trim() ? "Methodology is recorded." : "Add a methodology summary to the project brief.", status: project.methodology?.trim() ? "pass" : "warning" },
      { id: "manuscript", title: "Manuscript content", detail: substantive > 250 ? "Manuscript contains substantive text." : "The manuscript appears empty or very short.", status: substantive > 250 ? "pass" : "action" },
      { id: "sources", title: "Research library", detail: project.papers.length ? project.papers.length + " paper(s) saved in the project." : "No research papers are saved to this project.", status: project.papers.length ? "pass" : "warning" },
      { id: "citation-keys", title: "Citation keys", detail: missing.length ? "Missing bibliography keys: " + missing.join(", ") + "." : citations.length ? citations.length + " cited key(s) have matching BibTeX entries." : "No LaTeX citation commands were detected.", status: missing.length ? "action" : citations.length ? "pass" : "warning" },
      { id: "orphan-keys", title: "Uncited bibliography entries", detail: uncited.length ? uncited.length + " bibliography key(s) are not cited: " + uncited.slice(0, 8).join(", ") + (uncited.length > 8 ? "…" : "") + "." : "No uncited BibTeX entries detected.", status: uncited.length ? "warning" : "pass" },
      { id: "references", title: "Bibliography", detail: bibliography.length ? bibliography.length + " BibTeX reference(s) available." : "No BibTeX entries found.", status: bibliography.length ? "pass" : "warning" },
      { id: "figures", title: "Figure assets", detail: missingFigures.length ? "Referenced figure(s) missing from the project: " + missingFigures.join(", ") + "." : figureNames.length + " figure asset(s) saved; no missing referenced figures detected.", status: missingFigures.length ? "action" : "pass" },
      { id: "metadata", title: "Source metadata", detail: incompleteSources ? incompleteSources + " saved source(s) have neither DOI nor URL; verify their identity manually." : "Every saved source has a DOI or URL.", status: incompleteSources ? "warning" : "pass" },
      { id: "files", title: "Supporting files", detail: attachments.length + " supporting file(s) and " + notes.length + " project note(s) will be included in the export.", status: "pass" }
    ] as Finding[];
  }, [project, attachments.length, notes.length]);
  const passed = findings.filter(item => item.status === "pass").length;
  const actionCount = findings.filter(item => item.status === "action").length;
  const warningCount = findings.filter(item => item.status === "warning").length;
  const manualDone = manualItems.filter(item => project.submissionChecks?.[item.id]).length;
  const report = reportText(project, findings);
  const toggleManual = (id: string, checked: boolean) => onUpdateProject({ submissionChecks: { ...(project.submissionChecks || {}), [id]: checked } });

  const exportPackage = async () => {
    setExporting(true); setError(""); setMessage("");
    try {
      const zip = new JSZip(), root = cleanFileName(project.name);
      zip.file("README-SUBMISSION.txt", [
        "PaperOrchestra project export", "Project: " + project.name, "Exported: " + new Date().toISOString(), "",
        "Contents: manuscript.tex, references.bib, quality-report.md, project.json, notes/, figures/, templates/, supporting-files/",
        "Review the quality report. Automated checks do not certify scientific validity or ethical compliance.",
        "Project data in the browser is local to this device; this ZIP is a portable copy."
      ].join("\n"));
      zip.file("manuscript.tex", project.latex || "");
      zip.file("references.bib", project.bibtex || "");
      zip.file("quality-report.md", report);
      zip.file("project.json", JSON.stringify({ ...project, figures: project.figures.map(({ png, ...figure }) => figure), exportCreatedAt: new Date().toISOString() }, null, 2));
      const noteFolder = zip.folder("notes");
      notes.forEach((note, index) => noteFolder?.file(String(index + 1).padStart(3, "0") + "-" + cleanFileName(note.title) + ".md", "# " + note.title + "\n\n" + note.content));
      const figureFolder = zip.folder("figures");
      project.figures.forEach((figure, index) => {
        if (!figure.png) return;
        const ext = figure.mime === "image/svg+xml" ? "svg" : "png";
        const encoded = figure.png.includes(",") ? figure.png.split(",").pop()! : figure.png;
        figureFolder?.file(cleanFileName(figure.name || ("figure-" + (index + 1) + "." + ext)), encoded, { base64: true });
      });
      const templateFolder = zip.folder("templates");
      Object.entries(project.templateFiles || {}).forEach(([name, content]) => templateFolder?.file(name, content));
      const attachmentFolder = zip.folder("supporting-files");
      for (const attachment of attachments) attachmentFolder?.file(cleanFileName(attachment.name), attachment.blob);
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } });
      downloadBlob(blob, root + "-paperorchestra-submission.zip");
      setMessage("Submission package exported. Review the included quality report before submitting.");
    } catch (cause) { setError((cause as Error).message || "The submission package could not be created."); }
    finally { setExporting(false); }
  };

  return <section className="sr-shell">
    <header className="sr-header"><div><div className="sr-eyebrow"><ShieldCheck size={14}/> QUALITY & SUBMISSION</div><h2>Check your work before it leaves the workspace.</h2><p>Run structural checks, confirm research responsibilities and export a portable project package.</p></div><div className="sr-score"><strong>{passed}/{findings.length}</strong><span>automated checks passed</span></div></header>
    <div className="sr-summary"><div><strong>{passed}</strong><span>Passed</span></div><div><strong>{warningCount}</strong><span>Warnings</span></div><div><strong>{actionCount}</strong><span>Needs attention</span></div><div><strong>{manualDone}/{manualItems.length}</strong><span>Researcher confirmations</span></div></div>
    <section className="sr-panel"><div className="sr-panel-title"><div><Sparkles size={16}/><div><h3>Automated quality checks</h3><p>Checks are based on current project data and manuscript text.</p></div></div></div><div className="sr-findings">{findings.map(item => <article className="sr-finding" key={item.id}><div className={"sr-status sr-" + item.status}>{item.status === "pass" ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}</div><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className={"sr-tag sr-tag-" + item.status}>{item.status === "pass" ? "Passed" : item.status === "warning" ? "Review" : "Action"}</span></article>)}</div></section>
    <section className="sr-panel"><div className="sr-panel-title"><div><ClipboardCheck size={16}/><div><h3>Researcher confirmation</h3><p>These matters require human verification. PaperOrchestra cannot certify them automatically.</p></div></div></div><div className="sr-manual">{manualItems.map(item => <label key={item.id}><input type="checkbox" checked={Boolean(project.submissionChecks?.[item.id])} onChange={event => toggleManual(item.id, event.target.checked)}/><span>{item.label}</span></label>)}</div></section>
    <section className="sr-export"><div><div className="sr-eyebrow"><Archive size={14}/> PORTABLE PROJECT PACKAGE</div><h3>Export your research project</h3><p>Includes manuscript, BibTeX, figures, templates, project notes, supporting files, metadata and this quality report.</p><small>Files are packaged locally in your browser. Your original project remains unchanged.</small></div><button onClick={() => void exportPackage()} disabled={exporting}><Download size={15}/>{exporting ? "Preparing package…" : "Export submission ZIP"}</button></section>
    <div className="sr-secondary-actions"><button onClick={() => downloadBlob(new Blob([project.latex || ""], { type: "application/x-tex;charset=utf-8" }), "manuscript.tex")}><FileText size={14}/> Download LaTeX</button><button onClick={() => downloadBlob(new Blob([project.bibtex || ""], { type: "text/plain;charset=utf-8" }), "references.bib")}><FileText size={14}/> Download BibTeX</button><button onClick={() => downloadBlob(new Blob([report], { type: "text/markdown;charset=utf-8" }), "quality-report.md")}><ClipboardCheck size={14}/> Download report</button></div>
    {message && <div className="sr-message" role="status">{message}</div>}{error && <div className="sr-error" role="alert">{error}</div>}
    <p className="sr-disclaimer">A green result means a structural check passed—not that the research is scientifically correct, ethically approved, plagiarism-free or ready for acceptance. Verify source records and submission rules independently.</p>
  </section>;
}
