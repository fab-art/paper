import type { Paper, FigureAsset } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || "API error " + response.status);
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

function bibtexToHtml(bibtex: string) {
  const starts = [...bibtex.matchAll(/@[a-z]+\s*\{\s*([^,]+),/gi)];
  if (!starts.length) return "";
  const field = (source: string, name: string) => {
    const pattern = new RegExp("(?:^|,)\\s*" + name + "\\s*=\\s*(?:\\{([\\s\\S]*?)\\}|\"([\\s\\S]*?)\")\\s*,?", "i");
    const match = pattern.exec(source);
    return (match?.[1] || match?.[2] || "").replace(/[{}]/g, "").trim();
  };
  const rows = starts.map((entry, index) => {
    const bodyStart = entry.index! + entry[0].length;
    const nextStart = starts[index + 1]?.index ?? bibtex.length;
    const source = bibtex.slice(bodyStart, nextStart).replace(/\s*\}\s*$/, "");
    const author = field(source, "author").replace(/\s+and\s+/gi, ", ");
    const year = field(source, "year");
    const title = field(source, "title") || entry[1] || ("Reference " + (index + 1));
    const venue = field(source, "journal") || field(source, "booktitle") || field(source, "publisher");
    const doi = field(source, "doi");
    const url = field(source, "url");
    const details = [author, year, venue, doi ? "DOI: " + doi : ""].filter(Boolean).join(". ");
    const linked = /^https?:\/\//i.test(url) ? ' <a href="' + escapeXml(url) + '">' + escapeXml(url) + '</a>' : "";
    return "<li><strong>" + escapeXml(title) + "</strong>" + (details ? ". " + escapeXml(details) : "") + linked + "</li>";
  }).join("");
  return '<section class="references"><h2>References</h2><ol>' + rows + "</ol></section>";
}

function browserSvg(data: unknown[], x: string, y: string, title: string) {
  if (!Array.isArray(data) || !data.length) throw new Error("The dataset is empty.");
  const rows = data as Record<string, unknown>[];
  const valid = rows.map(row => ({ label: String(row[x] ?? ""), value: Number(row[y]) }))
    .filter(row => row.label && Number.isFinite(row.value));
  if (!valid.length) throw new Error("No valid numeric values found in column " + y + ".");
  const width = 960, height = 560, left = 90, right = 35, top = 70, bottom = 110;
  const min = Math.min(0, ...valid.map(d => d.value));
  const max = Math.max(...valid.map(d => d.value));
  const span = max - min || 1;
  const plotW = width - left - right, plotH = height - top - bottom;
  const barW = Math.min(52, plotW / valid.length * .58);
  const bars = valid.map((d, i) => {
    const xp = left + (i + .5) * plotW / valid.length;
    const yp = top + (max - d.value) / span * plotH;
    const zeroY = top + max / span * plotH;
    return '<rect x="' + (xp-barW/2) + '" y="' + yp + '" width="' + barW + '" height="' + Math.max(1,zeroY-yp) + '" rx="4" fill="#8276f1"/><text x="' + xp + '" y="' + (height-bottom+25) + '" text-anchor="middle" font-size="13" fill="#454653">' + escapeXml(d.label.slice(0,16)) + '</text><text x="' + xp + '" y="' + (yp-9) + '" text-anchor="middle" font-size="12" fill="#30313b">' + d.value + '</text>';
  }).join("");
  const grid = Array.from({length:5},(_,i)=>{
    const value=max-span*i/4, yy=top+plotH*i/4;
    return '<line x1="'+left+'" y1="'+yy+'" x2="'+(width-right)+'" y2="'+yy+'" stroke="#e6e6ed"/><text x="'+(left-12)+'" y="'+(yy+4)+'" text-anchor="end" font-size="12" fill="#666">'+Number(value.toFixed(2))+'</text>';
  }).join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><rect width="100%" height="100%" fill="white"/><text x="'+left+'" y="36" font-size="22" font-weight="600" fill="#20212a">'+escapeXml(title)+'</text>'+grid+bars+'<text x="'+(width/2)+'" y="'+(height-22)+'" text-anchor="middle" font-size="15" fill="#454653">'+escapeXml(x)+'</text><text transform="translate(24 '+(height/2)+') rotate(-90)" text-anchor="middle" font-size="15" fill="#454653">'+escapeXml(y)+'</text></svg>';
  return { filename:"figure.svg", png_base64:btoa(unescape(encodeURIComponent(svg))), mime_type:"image/svg+xml" };
}

export async function generatePlot(data: unknown[], x: string, y: string, title: string) {
  try {
    return await post<{filename:string;png_base64:string;pdf_base64?:string;mime_type?:string}>(
      "engine/generate-plot", { data, x, y, title }
    );
  } catch (error) {
    const message=(error as Error).message;
    if (!message.includes("Engine service is not configured") && !message.includes("PAPERORCHESTRA_ENGINE_TOKEN") && !message.includes("Compute requests are disabled until UPSTASH_REDIS_REST_URL") && !message.includes("Rate-limit service") && !message.includes("rate-limit window")) throw error;
    return browserSvg(data,x,y,title);
  }
}

export async function compileLatex(
  tex: string,
  bibtex: string,
  templateFiles: Record<string,string> = {},
  figures: FigureAsset[] = []
) {
  const assets = Object.fromEntries(figures
    .filter((figure) => figure.png && figure.mime !== "image/svg+xml")
    .map((figure, index) => [figure.name || "figure-" + (index + 1) + ".png", figure.png!]));
  try {
    return await post<{filename:string;pdf_base64:string}>(
      "engine/compile-latex",
      { tex, bibtex, files: templateFiles, assets }
    );
  } catch (error) {
    const message=(error as Error).message;
    if (!message.includes("Engine service is not configured") && !message.includes("PAPERORCHESTRA_ENGINE_TOKEN") && !message.includes("Compute requests are disabled until UPSTASH_REDIS_REST_URL") && !message.includes("Rate-limit service") && !message.includes("rate-limit window")) throw error;
    const esc=(s:string)=>s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]!));
    const title=tex.match(/\\title\{([\s\S]*?)\}/)?.[1]?.replace(/\\\\/g,"")||"Research Manuscript";
    const author=tex.match(/\\author\{([\s\S]*?)\}/)?.[1]?.replace(/\\\\/g," ")||"";
    const body=tex.replace(/%.*$/gm,"")
      .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g,"")
      .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g,"")
      .replace(/\\title\{([\s\S]*?)\}|\\author\{([\s\S]*?)\}|\\date\{([\s\S]*?)\}/g,"")
      .replace(/\\begin\{document\}|\\end\{document\}|\\maketitle/g,"")
      .replace(/\\section\*?\{([^}]*)\}/g,"\n\n<h2>$1</h2>\n")
      .replace(/\\subsection\*?\{([^}]*)\}/g,"\n\n<h3>$1</h3>\n")
      .replace(/\\textbf\{([^}]*)\}/g,"<strong>$1</strong>")
      .replace(/\\textit\{([^}]*)\}/g,"<em>$1</em>")
      .replace(/\\cite(?:p|t)?\{([^}]*)\}/g,"[$1]")
      .replace(/\\\\/g,"<br>")
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g,"")
      .replace(/[{}]/g,"").split(/\n{2,}/).map(p=>p.trim()).filter(Boolean)
      .map(p=>/^<h[23]>/.test(p)?p:"<p>"+p.replace(/\n/g," ")+"</p>").join("\n");
    const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font:11pt/1.6 Georgia,serif;max-width:820px;margin:50px auto;padding:0 40px}h1{text-align:center;margin:60px 0 12px}h2{margin-top:28px;border-bottom:1px solid #ddd}p{text-align:justify}.references{page-break-before:auto;margin-top:36px}.references li{margin:0 0 10px;text-align:left;overflow-wrap:anywhere}.references a{color:#333}@media print{body{margin:0 auto;padding:0 12mm}}</style></head><body><h1>'+esc(title)+'</h1><p style="text-align:center">'+esc(author)+'</p>'+body+bibtexToHtml(bibtex)+'<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),500))</script></body></html>';
    const url=URL.createObjectURL(new Blob([html],{type:"text/html"}));
    const opened=window.open(url,"_blank");
    if(!opened){URL.revokeObjectURL(url);throw new Error("Pop-up blocked. Allow pop-ups and try again.");}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return {filename:"print-preview.html",pdf_base64:"",browserPreview:true};
  }
}
