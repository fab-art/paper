export const MAX_DATASET_COLUMNS = 250;

export function assertDatasetColumnCount(count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_DATASET_COLUMNS) {
    throw new RangeError(`Dataset exceeds the safe limit of ${MAX_DATASET_COLUMNS} columns.`);
  }
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
    const originalName = safeFigureName(figure.name, `figure-${index + 1}.${ext}`);
    const dot = originalName.lastIndexOf(".");
    const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
    const extension = dot > 0 ? originalName.slice(dot) : `.${ext}`;
    let exportName = originalName;
    let suffix = 2;
    while (used.has(exportName.toLocaleLowerCase())) {
      exportName = `${stem}-${suffix++}${extension}`;
    }
    used.add(exportName.toLocaleLowerCase());
    return [{ ...figure, exportName, sourceIndex: index }];
  });
}

export function rewriteFigureReferences(tex, assets) {
  const firstByOriginalName = new Map();
  for (const asset of assets) {
    const original = safeFigureName(asset.name, asset.exportName).toLocaleLowerCase();
    if (!firstByOriginalName.has(original)) firstByOriginalName.set(original, asset.exportName);
  }
  return tex.replace(
    /\\includegraphics(\s*\[[^\]]*\])?\s*\{([^}]+)\}/g,
    (whole, options = "", reference) => {
      const basename = String(reference).replace(/\\/g, "/").split("/").pop()?.toLocaleLowerCase();
      const exportName = basename ? firstByOriginalName.get(basename) : undefined;
      return exportName ? `\\\\includegraphics${options}{figures/${exportName}}` : whole;
    }
  );
}

export function parseCitationUsage(tex, bib) {
  const bibliography = [...String(bib).matchAll(/@[a-zA-Z]+\s*\{\s*([^,\s]+)\s*,/g)]
    .map(match => match[1]);
  const found = new Set();
  let includeAll = false;
  const citationPattern = /\\([a-zA-Z]*cite[a-zA-Z]*|nocite)\*?(?:\s*\[[^\]]*\])*\s*\{([^}]*)\}/g;
  for (const match of String(tex).matchAll(citationPattern)) {
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
