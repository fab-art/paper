import type { Paper } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `API error ${response.status}`);
  }
  return response.json();
}

export async function searchPapers(query: string, limit = 6): Promise<{ papers: Paper[] }> {
  return post("search-papers", { query, limit });
}

function escapeXml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[c]!));
}

export async function generatePlot(data: unknown[], x: string, y: string, title: string) {
  if (!Array.isArray(data) || !data.length) throw new Error("The dataset is empty.");
  const rows = data as Record<string, unknown>[];
  const valid = rows.map(row => ({ label: String(row[x] ?? ""), value: Number(row[y]) }))
    .filter(row => row.label && Number.isFinite(row.value));
  if (!valid.length) throw new Error(`No valid numeric values found in column "${y}".`);
  const width = 960, height = 560, left = 90, right = 35, top = 70, bottom = 110;
  const min = Math.min(0, ...valid.map(d => d.value));
  const max = Math.max(...valid.map(d => d.value));
  const span = max - min || 1;
  const plotW = width - left - right, plotH = height - top - bottom;
  const barW = Math.min(52, plotW / valid.length * .58);
  const bars = valid.map((d, i) => {
    const xPos = left + (i + .5) * plotW / valid.length;
    const yPos = top + (max - d.value) / span * plotH;
    const zeroY = top + (max - 0) / span * plotH;
    const h = Math.max(1, zeroY - yPos);
    return `<rect x="${xPos-barW/2}" y="${yPos}" width="${barW}" height="${h}" rx="4" fill="#8276f1"/><text x="${xPos}" y="${height-bottom+25}" text-anchor="middle" font-size="13" fill="#454653">${escapeXml(d.label.slice(0,16))}</text><text x="${xPos}" y="${yPos-9}" text-anchor="middle" font-size="12" fill="#30313b">${d.value}</text>`;
  }).join("");
  const grid = Array.from({length: 5}, (_,i) => {
    const value = max - span * i / 4, yy = top + plotH * i / 4;
    return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#e6e6ed" stroke-width="1"/><text x="${left-12}" y="${yy+4}" text-anchor="end" font-size="12" fill="#666">${Number(value.toFixed(2))}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="${left}" y="36" font-size="22" font-weight="600" fill="#20212a">${escapeXml(title)}</text>${grid}${bars}<text x="${width/2}" y="${height-22}" text-anchor="middle" font-size="15" fill="#454653">${escapeXml(x)}</text><text transform="translate(24 ${height/2}) rotate(-90)" text-anchor="middle" font-size="15" fill="#454653">${escapeXml(y)}</text></svg>`;
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return { filename: "figure.svg", png_base64: encoded, mime_type: "image/svg+xml" };
}

/**
 * Vercel's serverless runtime is intentionally not used to run TeX binaries.
 * This helper creates a clean, print-ready HTML manuscript for browser Save as PDF.
 */
export async function compileLatex(tex: string, bibtex: string) {
  const escapeHtml = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const title = tex.match(/\\title\{([\s\S]*?)\}/)?.[1]?.replace(/\\\\/g, "") || "Research Manuscript";
  const author = tex.match(/\\author\{([\s\S]*?)\}/)?.[1]?.replace(/\\\\/g, " ") || "";
  let body = tex
    .replace(/%.*$/gm, "")
    .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\title\{([\s\S]*?)\}/g, "")
    .replace(/\\author\{([\s\S]*?)\}/g, "")
    .replace(/\\date\{([\s\S]*?)\}/g, "")
    .replace(/\\begin\{document\}|\\end\{document\}|\\maketitle/g, "")
    .replace(/\\section\*?\{([^}]*)\}/g, "\n\n<h2>$1</h2>\n")
    .replace(/\\subsection\*?\{([^}]*)\}/g, "\n\n<h3>$1</h3>\n")
    .replace(/\\subsubsection\*?\{([^}]*)\}/g, "\n\n<h4>$1</h4>\n")
    .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
    .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
    .replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>")
    .replace(/\\cite(?:p|t)?\{([^}]*)\}/g, "[$1]")
    .replace(/\\\\/g, "<br>")
    .replace(/\\(begin|end)\{(abstract|itemize|enumerate)\}/g, "")
    .replace(/\\item\s*/g, "• ")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
    .replace(/[{}]/g, "")
    .split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => /^<h[234]>/.test(p) ? p : `<p>${p.replace(/\n/g, " ")}</p>`).join("\n");
  const bibliography = bibtex.trim()
    ? `<h2>References</h2><pre>${escapeHtml(bibtex)}</pre>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:11pt/1.6 Georgia,serif;color:#171717;max-width:820px;margin:50px auto;padding:0 40px}h1{text-align:center;font-size:22pt;margin:60px 0 12px}h2{font-size:15pt;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:5px}h3{font-size:12pt}p{text-align:justify}pre{white-space:pre-wrap;font:9pt/1.4 monospace;overflow-wrap:anywhere}@media print{body{margin:0 auto;padding:0 12mm}h2,h3{break-after:avoid}p{orphans:3;widows:3}}</style></head><body><h1>${escapeHtml(title)}</h1><p style="text-align:center">${escapeHtml(author)}</p>${body}${bibliography}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))</script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const opened = window.open(url, "_blank");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked. Allow pop-ups for this site, then try Print / Save PDF again.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { pdf_base64: "", filename: "print-preview.html" };
}
