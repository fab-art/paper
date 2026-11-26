const latexEscape = (value) => String(value)
  .replace(/\\\\/g, "\\textbackslash{}")
  .replace(/([{}#$%&_])/g, "\\\\$1");

export function insertLatexSection(latex, title, body) {
  const source = String(latex ?? "");
  const escapedTitle = latexEscape(title);
  const matcher = new RegExp("\\\\\\\\section\\\\*?\\\\{" + escapedTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "\\\\}", "i");
  const match = matcher.exec(source);
  if (match && match.index >= 0) {
    const afterHeading = match.index + match[0].length;
    const label = /^\\s*\\\\label\\\\{[^}]+\\\\}\\s*/.exec(source.slice(afterHeading));
    const contentStart = afterHeading + (label?.[0].length || 0);
    const tail = source.slice(contentStart);
    const boundary = /\\\\section\\\\*?\\\\{|\\\\bibliography\\\\{|\\\\begin\\\\{thebibliography\\\\}|\\\\end\\\\{document\\\\}/.exec(tail);
    const contentEnd = boundary ? contentStart + boundary.index : source.length;
    return source.slice(0, contentStart) + "\\n" + String(body).trim() + "\\n\\n" + source.slice(contentEnd);
  }
  const boundary = /\\\\bibliography\\\\{|\\\\begin\\\\{thebibliography\\\\}|\\\\end\\\\{document\\\\}/.exec(source);
  const index = boundary ? boundary.index : source.length;
  const block = "\\n\\\\section{" + escapedTitle + "}\\n" + String(body).trim() + "\\n";
  return source.slice(0, index) + block + source.slice(index);
}

export function findUndefinedCitationKeys(latex, bibtex) {
  const known = new Set([...String(bibtex ?? "").matchAll(/@[a-z]+\\s*\\{\\s*([^,\\s]+)\\s*,/gi)].map(match => match[1]));
  const cited = new Set();
  for (const match of String(latex ?? "").matchAll(/\\\\cite(?:[a-zA-Z]+)?\\*?(?:\\[[^\\]]*\\]){0,2}\\s*\\{([^}]+)\\}/g)) {
    for (const key of match[1].split(",")) {
      const normalized = key.trim();
      if (normalized && !known.has(normalized)) cited.add(normalized);
    }
  }
  return [...cited].sort();
}
