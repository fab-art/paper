import { useEffect, useState, type FormEvent } from "react";
import { Download, LockKeyhole, Settings2, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Project } from "../../../../frontend/src/lib/types";
import { isSupabaseConfigured, supabase } from "../../../../frontend/src/lib/supabase";
import { listLocalProjects } from "../adapters/legacy-projects";

function downloadBackup(projects: Project[]) {
  const payload = {
    format: "paperorchestra-local-project-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `paperorchestra-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click(); URL.revokeObjectURL(url);
}

export default function SettingsWorkspace({ theme, onThemeChange }: {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listLocalProjects().then(rows => { if (active) setProjects(rows); }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "The local project library could not be read.");
    });
    if (!supabase) { setLoading(false); return () => { active = false; }; }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const current = data.session?.user ?? null;
      setUser(current);
      setEmail(current?.email ?? "");
      if (current) {
        const { data: profile } = await supabase!.from("profiles").select("display_name").eq("id", current.id).maybeSingle();
        if (active) setDisplayName(profile?.display_name ?? "");
      }
      if (active) setLoading(false);
    }).catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : "Account settings could not be loaded."); setLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setEmail(session?.user?.email ?? "");
        setDisplayName("");
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: saveError } = await supabase.from("profiles").upsert({
        id: user.id, display_name: displayName.trim() || null, updated_at: new Date().toISOString()
      });
      if (saveError) throw saveError;
      setNotice("Profile updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Profile update failed."); }
    finally { setBusy(false); }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/settings`, shouldCreateUser: true }
      });
      if (authError) throw authError;
      setNotice("Check your email for the secure sign-in link.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign-in link could not be sent."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="manage-loading" role="status">Loading settings…</div>;

  return <section className="manage-workspace">
    <div className="manage-toolbar"><div><p className="eyebrow">MANAGE · PREFERENCES</p><h2>Settings</h2><p>Control your workspace appearance, account and local data. Local-first storage remains the default.</p></div></div>
    {error && <p className="plan-message error" role="alert">{error}</p>}
    {notice && <p className="plan-message success" role="status">{notice}</p>}
    <div className="manage-panel">
      <div className="manage-panel-heading"><div><h3><Settings2 size={16}/> Appearance</h3><p>Choose the theme used throughout the Research Factory.</p></div></div>
      <label className="manage-setting-row"><span><strong>Color theme</strong><small>Saved on this device.</small></span><select value={theme} onChange={event => onThemeChange(event.target.value as "light" | "dark")}><option value="light">Light</option><option value="dark">Dark</option></select></label>
    </div>
    <div className="manage-panel">
      <div className="manage-panel-heading"><div><h3><UserRound size={16}/> Account</h3><p>Supabase account is used only for optional shared projects.</p></div><span className={isSupabaseConfigured ? "manage-status ready" : "manage-status"}>{isSupabaseConfigured ? "Connected" : "Not configured"}</span></div>
      {!isSupabaseConfigured ? <p className="manage-muted">Cloud account features require the Supabase URL and publishable key in the Vercel environment. Your local workspace is unaffected.</p> : user ? <>
        <div className="manage-account-card"><strong>{user.email}</strong><small>Account ID — share this UUID with a project owner if they need to add you as a collaborator.</small><code>{user.id}</code></div>
        <form className="manage-settings-form" onSubmit={saveProfile}><label>Display name<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name"/></label><button type="submit" className="manage-button" disabled={busy}>Save profile</button></form>
        <button type="button" className="manage-button secondary" onClick={() => void supabase?.auth.signOut()}>Sign out</button>
      </> : <form className="manage-settings-form" onSubmit={sendMagicLink}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><button type="submit" className="manage-button" disabled={busy}>Send sign-in link</button></form>}
    </div>
    <div className="manage-panel">
      <div className="manage-panel-heading"><div><h3><LockKeyhole size={16}/> Privacy and storage</h3><p>Clear boundaries between local research and optional cloud collaboration.</p></div></div>
      <div className="manage-privacy-list">
        <div><strong>Local-first by default</strong><span>Projects, manuscripts, screening and analysis remain in browser IndexedDB.</span></div>
        <div><strong>Explicit cloud sharing</strong><span>A project is copied to Supabase only when you choose Share project in Collaboration.</span></div>
        <div><strong>No background sync</strong><span>Push and pull actions are manual and revision-checked. No automatic upload runs in the background.</span></div>
        <div><strong>Excluded from cloud payloads</strong><span>Local execution logs, model agent records, template files and binary figure assets are not included when sharing.</span></div>
      </div>
    </div>
    <div className="manage-panel">
      <div className="manage-panel-heading"><div><h3><Download size={16}/> Local project backup</h3><p>Export a portable JSON backup of your project records.</p></div></div>
      <div className="manage-backup-row"><div><strong>{projects.length} project record(s)</strong><small>Backup includes project metadata, manuscripts, references and review records. It does not include separately stored attachments or notes.</small></div><button type="button" className="manage-button" onClick={() => downloadBackup(projects)} disabled={projects.length === 0}><Download size={14}/> Export JSON backup</button></div>
    </div>
  </section>;
}
