import JSZip from "jszip";
import type { Project } from "../../../../frontend/src/lib/types";

export async function exportProject(project: Project, pdfBase64?: string) {
  const zip = new JSZip();
  zip.file("paper.tex", project.latex || "");
  zip.file("references.bib", project.bibtex || "");
  zip.file("notes.md", project.notes || "");
  zip.file("experiment-data.txt", project.logs || "");
  zip.file("project.json", JSON.stringify(project, null, 2));
  if (project.templateFiles) Object.entries(project.templateFiles).forEach(([name, content]) => zip.file(name, content));
  const figures = zip.folder("figures");
  project.figures.forEach((figure, i) => {
    if (figure.png) figures?.file(figure.name || `figure-${i + 1}.png`, figure.png, { base64: true });
    if (figure.code) figures?.file(`figure-${i + 1}.py`, figure.code);
  });
  if (pdfBase64) zip.file("paper.pdf", pdfBase64, { base64: true });
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${slug(project.name)}.zip`; a.click();
  URL.revokeObjectURL(url);
}
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "paper"; }
