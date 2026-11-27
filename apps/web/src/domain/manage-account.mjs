export async function loadAccountProfile(client, user) {
  if (!user) return { user: null, email: "", displayName: "" };
  if (!client) throw new Error("Account profile storage is not configured.");
  const { data, error } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    user,
    email: user.email ?? "",
    displayName: data?.display_name ?? ""
  };
}
