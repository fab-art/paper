export type ProjectWriteGuardOptions = {
  getDeletedProject: (projectId: string) => Promise<unknown> | unknown;
  getProject: (projectId: string) => Promise<unknown> | unknown;
};
export const PROJECT_DELETED_MESSAGE: string;
export const PROJECT_MISSING_MESSAGE: string;
export function assertProjectWritable(projectId: string, options: ProjectWriteGuardOptions): Promise<void>;
