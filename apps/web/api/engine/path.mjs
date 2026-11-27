export function normalizeEnginePath(raw) {
  const segments = Array.isArray(raw) ? raw : String(raw ?? "").split("/");
  return segments.map(segment => segment.trim()).filter(Boolean).at(-1) ?? "";
}
