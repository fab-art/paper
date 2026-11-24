export const PROJECT_CONFLICT_MESSAGE =
  "This project was updated in another tab. Your local changes were not saved. Reload the project before continuing.";

export function assertProjectRevision(expectedRevision, actualRevision) {
  const expected = Number(expectedRevision ?? 0);
  const actual = Number(actualRevision ?? 0);
  if (expected !== actual) {
    throw new Error(PROJECT_CONFLICT_MESSAGE);
  }
}
