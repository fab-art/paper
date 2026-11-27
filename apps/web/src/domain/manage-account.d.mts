export type AccountUser = { id: string; email?: string | null };
export function loadAccountProfile(client: unknown, user: AccountUser | null): Promise<{ user: AccountUser | null; email: string; displayName: string }>;
