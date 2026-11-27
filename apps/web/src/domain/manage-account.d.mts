export type AccountUser = { id: string; email?: string | null };
export type AccountProfileClient = {
  from(table: "profiles"): {
    select(columns: "display_name"): {
      eq(column: "id", value: string): {
        maybeSingle(): Promise<{ data: { display_name: string | null } | null; error: Error | null }>;
      };
    };
  };
};
export function loadAccountProfile(client: AccountProfileClient | null, user: AccountUser | null): Promise<{ user: AccountUser | null; email: string; displayName: string }>;
