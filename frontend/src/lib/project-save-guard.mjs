export function projectFingerprint(project) {
  if (!project || typeof project !== "object") return "";
  const { revision, updatedAt, ...content } = project;
  return JSON.stringify(content);
}

export function shouldSaveProjectSnapshot(snapshot, current, lastSavedFingerprint = "") {
  if (!snapshot || !current || snapshot.id !== current.id) return false;
  const fingerprint = projectFingerprint(snapshot);
  return fingerprint !== lastSavedFingerprint && fingerprint === projectFingerprint(current);
}
