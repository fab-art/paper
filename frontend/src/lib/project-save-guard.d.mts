import type { Project } from "./types";
export function projectFingerprint(project: Project | null | undefined): string;
export function shouldSaveProjectSnapshot(
  snapshot: Project | null | undefined,
  current: Project | null | undefined,
  lastSavedFingerprint?: string
): boolean;
