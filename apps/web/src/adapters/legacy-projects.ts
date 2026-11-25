import { listProjects } from "../../../../frontend/src/lib/db";
import type { Project } from "../../../../frontend/src/lib/types";

/**
 * Read-only bridge to the existing local project store.
 * Do not add writes here: mutations belong to explicit feature services and
 * must preserve the legacy revision/tombstone guards.
 */
export async function listLocalProjects(): Promise<Project[]> {
  return listProjects();
}
