export const PROJECT_DELETED_MESSAGE =
  "This project was permanently deleted in another tab. Reload the Research Station before continuing.";

export const PROJECT_MISSING_MESSAGE =
  "This project no longer exists in the local research library. Reload the Research Station before continuing.";

export async function assertProjectWritable(
  projectId,
  { getDeletedProject, getProject }
) {
  if (await getDeletedProject(projectId)) {
    throw new Error(PROJECT_DELETED_MESSAGE);
  }
  if (!(await getProject(projectId))) {
    throw new Error(PROJECT_MISSING_MESSAGE);
  }
}
