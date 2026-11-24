export const MAX_DATASET_COLUMNS = 250;
export const MAX_DATASET_CELLS = 500000;

export function assertDatasetColumnCount(count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_DATASET_COLUMNS) {
    throw new RangeError("Dataset exceeds the safe limit of " + MAX_DATASET_COLUMNS + " columns.");
  }
}

export function canRetainDatasetRow(currentCells, rowCells) {
  return Number.isInteger(currentCells) && Number.isInteger(rowCells) &&
    currentCells >= 0 && rowCells > 0 && currentCells + rowCells <= MAX_DATASET_CELLS;
}

export function safeTemplatePath(value) {
  const normalized = String(value || "").normalize("NFKC").replace(/\\/g, "/");
  const segments = normalized.split("/")
    .filter(segment => segment && segment !== "." && segment !== "..")
    .map(segment => segment.replace(/[^\p{L}\p{N}._-]+/gu, "_"));
  let path = segments.join("/").replace(/^templates\//i, "");
  if (!path) path = "template-file";
  const reserved = new Set(["manuscript.tex", "references.bib", "project.json", "quality-report.md", "readme-submission.txt"]);
  if (!path.includes("/") && reserved.has(path.toLocaleLowerCase())) path = "template-assets/" + path;
  return path;
}

function safeFigureName(value, fallback) {
  const normalized = String(value || fallback).normalize("NFKC").replace(/\\/g, "/");
  const basename = normalized.split("/").filter(Boolean).pop() || fallback;
  const safe = basename.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "");
  return safe && safe !== "." && safe !== ".." ? safe : fallback;
}

export function createUniqueFigureAssets(figures) {
  const used = new Set();
  return figures.flatMap((figure, index) => {
    if (!figure.png) return [];
    const ext = figure.mime === "image/svg+xml" ? "svg" : "png";
    const originalName = safeFigureName(figure.name, "figure-" + (index + 1) + "." + ext);
    const dot = originalName.lastIndexOf(".");
    const hasExtension = dot > 0;
    const stem = hasExtension ? originalName.slice(0, dot) : originalName;
    const extension = hasExtension ? originalName.slice(dot) : "." + ext;
    let exportName = hasExtension ? originalName : originalName + extension;
    let suffix = 2;
    while (used.has(exportName.toLocaleLowerCase())) {
      exportName = stem + "-" + suffix++ + extension;
    }
    used.add(exportName.toLocaleLowerCase());
    return [{ ...figure, exportName, sourceIndex: index }];
  });
}

export function rewriteFigureReferences(tex, assets) {
  const exactNames = new Map();
  const extensionlessNames = new Map();
  for (const asset of assets) {
    const original = safeFigureName(asset.name, asset.exportName).toLocaleLowerCase();
    if (!exactNames.has(original)) exactNames.set(original, asset.exportName);
    const dot = original.lastIndexOf(".");
    const stem = dot > 0 ? original.slice(0, dot) : original;
    if (!extensionlessNames.has(stem)) extensionlessNames.set(stem, asset.exportName);
  }
  return tex.replace(
    /\\includegraphics(\s*\[[^\]]*\])?\s*\{([^}]+)\}/g,
    (whole, options = "", reference) => {
      const basename = String(reference).replace(/\\/g, "/").split("/").pop()?.toLocaleLowerCase();
      if (!basename) return whole;
      const hasExtension = /\.[a-z0-9]{2,6}$/i.test(basename);
      const exportName = exactNames.get(basename) || (!hasExtension ? extensionlessNames.get(basename) : undefined);
      return exportName ? "\\includegraphics" + options + "{figures/" + exportName + "}" : whole;
    }
  );
}

export function stripLatexComments(tex) {
  return String(tex).split(/\r?\n/).map(line => {
    let precedingSlashes = 0;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === "%" && precedingSlashes % 2 === 0) return line.slice(0, index);
      if (char === "\\") precedingSlashes++;
      else precedingSlashes = 0;
    }
    return line;
  }).join("\n");
}

export function parseCitationUsage(tex, bib) {
  const bibliography = [...String(bib).matchAll(/@[a-zA-Z]+\s*\{\s*([^,\s]+)\s*,/g)]
    .map(match => match[1]);
  const found = new Set();
  let includeAll = false;
  const citationPattern = /\\([a-zA-Z]*cite[a-zA-Z]*|nocite)\*?(?:\s*\[[^\]]*\])*\s*\{([^}]*)\}/g;
  const cleanTex = stripLatexComments(tex);
  for (const match of cleanTex.matchAll(citationPattern)) {
    const command = match[1].toLowerCase();
    const keys = match[2].split(",").map(value => value.trim()).filter(Boolean);
    if (command === "nocite" && keys.includes("*")) {
      includeAll = true;
      continue;
    }
    keys.filter(key => key !== "*").forEach(key => found.add(key));
  }
  const citedKeys = includeAll ? [...bibliography] : [...found];
  const bibliographySet = new Set(bibliography);
  const citedSet = new Set(citedKeys);
  return {
    bibliography,
    citedKeys,
    missing: citedKeys.filter(key => !bibliographySet.has(key)),
    uncited: bibliography.filter(key => !citedSet.has(key))
  };
}

function normalizeBibTitle(value) {
  return String(value).replace(/[{}]/g, "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function extractBibtexTitles(source) {
  const titles = [];
  const matcher = /\btitle\s*=\s*/gi;
  let match;
  while ((match = matcher.exec(String(source)))) {
    let cursor = matcher.lastIndex;
    const parts = [];
    while (cursor < source.length) {
      while (/\s/.test(source[cursor] || "")) cursor++;
      const opener = source[cursor];
      if (opener === "{") {
        cursor++;
        let depth = 1;
        let value = "";
        while (cursor < source.length && depth > 0) {
          const char = source[cursor];
          if (char === "\\" && cursor + 1 < source.length) {
            value += char + source[cursor + 1];
            cursor += 2;
          } else if (char === "{") {
            depth++;
            if (depth > 1) value += char;
            cursor++;
          } else if (char === "}") {
            depth--;
            if (depth > 0) value += char;
            cursor++;
          } else {
            value += char;
            cursor++;
          }
        }
        parts.push(value);
      } else if (opener === '"') {
        cursor++;
        let value = "";
        while (cursor < source.length) {
          const char = source[cursor++];
          if (char === "\\" && cursor < source.length) value += char + source[cursor++];
          else if (char === '"') break;
          else value += char;
        }
        parts.push(value);
      } else {
        const start = cursor;
        while (cursor < source.length && !/[#,\r\n}]/.test(source[cursor])) cursor++;
        parts.push(source.slice(start, cursor).trim());
      }
      while (/\s/.test(source[cursor] || "")) cursor++;
      if (source[cursor] === "#") {
        cursor++;
        continue;
      }
      break;
    }
    titles.push(normalizeBibTitle(parts.join(" ")));
    matcher.lastIndex = cursor;
  }
  return titles;
}
