import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, Cloud, MessageSquare, RefreshCw, Shield, Users } from "lucide-react";
type User = { id: string; email?: string | null };
import type { Project } from "../../../../frontend/src/lib/types";
import type { Json, Tables } from "../../../../frontend/src/lib/database.types";
import { isSupabaseConfigured, supabase } from "../../../../frontend/src/lib/supabase";
import { listLocalProjects, updateLocalProject } from "../adapters/legacy-projects";
import { canEditSharedProject, canManageProjectMembers, createSharedProjectPayload, mergeSharedProjectPayload, normalizeProjectComment, validateMemberAssignment } from "../domain/collaboration.mjs";

type SharedProject = Tables<"shared_projects">;
type Member = Tables<"project_members">;
type Comment = Tables<"project_comments">;
type ActivityRecord = Tables<"project_activity">;
type VersionRecord = Tables<"project_versions">;

export default function CollaborationWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [localProjectId, setLocalProjectId] = useState("");
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  const [selectedCloudId, setSelectedCloudId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("editor");
  const [commentBody, setCommentBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    listLocalProjects().then(rows => {
      if (!active) return;
      const available = rows.filter(item => !item.archivedAt);
      setLocalProjects(available);
      setLocalProjectId(available[0]?.id ?? "");
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "The local project library could not be opened."); });
    if (!supabase) { setLoading(false); return () => { active = false; }; }
    supabase.auth.getSession().then(({ data }) => { if (active) setUser(data.session?.user ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setEmailSent(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const localProject = useMemo(() => localProjects.find(item => item.id === localProjectId) ?? null, [localProjects, localProjectId]);
  const selectedCloud = useMemo(() => sharedProjects.find(item => item.id === selectedCloudId) ?? null, [sharedProjects, selectedCloudId]);
  const myRole = members.find(item => item.user_id === user?.id)?.role ?? null;
  const canEdit = canEditSharedProject(myRole);
  const canManageMembers = canManageProjectMembers(myRole);

  async function refreshShared() {
    if (!supabase || !user) return;
    setBusy(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("shared_projects").select("*").order("updated_at", { ascending: false });
      if (queryError) throw queryError;
      const rows = data ?? [];
      setSharedProjects(rows);
      if (!rows.some(item => item.id === selectedCloudId)) setSelectedCloudId(rows[0]?.id ?? "");
      setNotice("Shared project list refreshed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Shared projects could not be loaded."); }
    finally { setBusy(false); setLoading(false); }
  }

  async function refreshDetails(projectId: string) {
    if (!supabase || !user || !projectId) return;
    try {
      const [memberResult, commentResult, activityResult, versionResult] = await Promise.all([
        supabase.from("project_members").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        supabase.from("project_comments").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("project_activity").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
        supabase.from("project_versions").select("*").eq("project_id", projectId).order("revision", { ascending: false }).limit(20)
      ]);
      if (memberResult.error) throw memberResult.error;
      if (commentResult.error) throw commentResult.error;
      if (activityResult.error) throw activityResult.error;
      if (versionResult.error) throw versionResult.error;
      const memberRows = memberResult.data ?? [];
      setMembers(memberRows); setComments(commentResult.data ?? []);
      setActivity(activityResult.data ?? []); setVersions(versionResult.data ?? []);
      const ids = [...new Set(memberRows.map(item => item.user_id))];
      if (ids.length) {
        const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,display_name").in("id", ids);
        if (profileError) throw profileError;
        setProfileNames(Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile.display_name || profile.id])));
      } else setProfileNames({});
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Collaboration details could not be loaded."); }
  }

  useEffect(() => {
    if (user) void refreshShared();
    else { setSharedProjects([]); setSelectedCloudId(""); setMembers([]); setComments([]); setActivity([]); setVersions([]); setLoading(false); }
  }, [user?.id]);

  useEffect(() => { if (selectedCloudId && user) void refreshDetails(selectedCloudId); }, [selectedCloudId, user?.id]);
  useEffect(() => {
    const linked = localProjects.find(item => item.cloudProjectId === selectedCloudId);
    if (linked) setLocalProjectId(linked.id);
  }, [selectedCloudId, localProjects]);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/collaboration`, shouldCreateUser: true }
      });
      if (authError) throw authError;
      setEmailSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "A sign-in link could not be sent."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(authError.message);
  }

  async function shareLocalProject() {
    if (!supabase || !user || !localProject) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = createSharedProjectPayload(localProject);
      const { data, error: rpcError } = await supabase.rpc("create_shared_project", { p_name: localProject.name || "Untitled project", p_payload: payload as unknown as Json });
      if (rpcError) throw rpcError;
      const saved = await updateLocalProject({ ...localProject, cloudProjectId: data, cloudRevision: 1 });
      if (!saved) throw new Error("The cloud copy was created, but its local link could not be saved. Refresh local projects and reconnect it.");
      setLocalProjects(rows => rows.map(item => item.id === saved.id ? saved : item));
      await refreshShared();
      setSelectedCloudId(data);
      setNotice("Project shared. Your original local project remains available on this device.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The project could not be shared."); }
    finally { setBusy(false); }
  }

  async function pushLocalChanges() {
    if (!supabase || !user || !localProject || !selectedCloud || !canEdit) return;
    if (localProject.cloudProjectId !== selectedCloud.id) { setError("Select the local project linked to this shared project before pushing changes."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = createSharedProjectPayload(localProject);
      if (myRole === "editor") payload.project.name = selectedCloud.name;
      const { data, error: rpcError } = await supabase.rpc("update_shared_project", {
        p_project_id: selectedCloud.id, p_expected_revision: selectedCloud.revision,
        p_name: myRole === "owner" ? localProject.name : selectedCloud.name,
        p_payload: payload as unknown as Json
      });
      if (rpcError) throw rpcError;
      const saved = await updateLocalProject({ ...localProject, cloudProjectId: selectedCloud.id, cloudRevision: data });
      if (!saved) throw new Error("Cloud update succeeded, but local revision metadata could not be saved.");
      setLocalProjects(rows => rows.map(item => item.id === saved.id ? saved : item));
      await refreshShared(); await refreshDetails(selectedCloud.id);
      setNotice(`Cloud project updated to revision ${data}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Cloud update failed. Refresh and compare revisions."); }
    finally { setBusy(false); }
  }

  async function pullCloudChanges() {
    if (!supabase || !selectedCloud || !localProject) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const merged = mergeSharedProjectPayload(localProject, selectedCloud.payload, { cloudProjectId: selectedCloud.id, cloudRevision: selectedCloud.revision });
      const saved = await updateLocalProject(merged);
      if (!saved) throw new Error("The local project changed elsewhere. Reload it before pulling the cloud version.");
      setLocalProjects(rows => rows.map(item => item.id === saved.id ? saved : item));
      setNotice(`Cloud revision ${selectedCloud.revision} pulled into the local project.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Cloud changes could not be applied."); }
    finally { setBusy(false); }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedCloud || !user || !canManageMembers) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const assignment = validateMemberAssignment(memberId, memberRole);
      const { error: insertError } = await supabase.from("project_members").insert({
        project_id: selectedCloud.id, user_id: assignment.userId, role: assignment.role, added_by: user.id
      });
      if (insertError) throw insertError;
      setMemberId(""); await refreshDetails(selectedCloud.id);
      setNotice("Existing PaperOrchestra account added to the project.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The collaborator could not be added."); }
    finally { setBusy(false); }
  }

  async function changeMemberRole(member: Member, role: "editor" | "viewer") {
    if (!supabase || !selectedCloud || !canManageMembers) return;
    setBusy(true); setError("");
    try {
      const { error: updateError } = await supabase.from("project_members").update({ role }).eq("project_id", selectedCloud.id).eq("user_id", member.user_id);
      if (updateError) throw updateError;
      await refreshDetails(selectedCloud.id); setNotice("Collaborator role updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The role could not be updated."); }
    finally { setBusy(false); }
  }

  async function removeMember(member: Member) {
    if (!supabase || !selectedCloud || !canManageMembers || member.role === "owner") return;
    if (!window.confirm("Remove this collaborator from the shared project?")) return;
    setBusy(true); setError("");
    try {
      const { error: deleteError } = await supabase.from("project_members").delete().eq("project_id", selectedCloud.id).eq("user_id", member.user_id);
      if (deleteError) throw deleteError;
      await refreshDetails(selectedCloud.id); setNotice("Collaborator removed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The collaborator could not be removed."); }
    finally { setBusy(false); }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedCloud || !user || !canEdit) return;
    setBusy(true); setError("");
    try {
      const values = normalizeProjectComment({ projectId: selectedCloud.id, authorId: user.id, body: commentBody });
      const { error: insertError } = await supabase.from("project_comments").insert(values);
      if (insertError) throw insertError;
      setCommentBody(""); await refreshDetails(selectedCloud.id); setNotice("Comment posted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Comment could not be posted."); }
    finally { setBusy(false); }
  }

  async function resolveComment(comment: Comment) {
    if (!supabase || !selectedCloud || !user || !canEdit) return;
    const { error: updateError } = await supabase.from("project_comments").update({
      resolved_at: comment.resolved_at ? null : new Date().toISOString(),
      resolved_by: comment.resolved_at ? null : user.id
    }).eq("id", comment.id);
    if (updateError) setError(updateError.message);
    else await refreshDetails(selectedCloud.id);
  }

  if (!isSupabaseConfigured || !supabase) return <section className="manage-workspace"><div className="manage-panel"><Cloud size={24}/><h2>Cloud collaboration is not configured</h2><p>Add the Supabase project URL and publishable key to the Vercel environment. Local projects continue to work without cloud access.</p></div></section>;

  if (!user) return <section className="manage-workspace">
    <div className="manage-toolbar"><div><p className="eyebrow">MANAGE · COLLABORATION</p><h2>Work together, by invitation</h2><p>Sign in to enable optional cloud collaboration. Your local research library remains separate until you explicitly share a project.</p></div></div>
    <form className="manage-panel manage-auth" onSubmit={sendMagicLink}>
      <h3>Sign in with email</h3><label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
      <button className="manage-button" type="submit" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send secure sign-in link"}</button>
      {emailSent && <p className="manage-success" role="status">Check your email for a one-time sign-in link. Return here after confirming it.</p>}
      <p className="manage-muted">Magic-link delivery depends on the Supabase Auth email and redirect URL configuration.</p>
    </form>
    {error && <p className="plan-message error" role="alert">{error}</p>}
  </section>;

  return <section className="manage-workspace">
    <div className="manage-toolbar"><div><p className="eyebrow">MANAGE · COLLABORATION</p><h2>Shared research projects</h2><p>Cloud sharing is explicit and project-by-project. Owners control membership; editors can update research content; viewers have read-only access.</p></div><div className="manage-account"><span>{user.email}</span><button type="button" className="manage-text-button" onClick={() => void signOut()}>Sign out</button></div></div>
    {error && <p className="plan-message error" role="alert">{error}</p>}
    {notice && <p className="plan-message success" role="status">{notice}</p>}
    <div className="manage-panel">
      <div className="manage-panel-heading"><div><h3>Share a local project</h3><p>Creates a cloud copy only when you choose to share.</p></div></div>
      <div className="manage-inline-form"><label>Local project<select value={localProjectId} onChange={event => setLocalProjectId(event.target.value)}><option value="">Select project</option>{localProjects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label><button className="manage-button" type="button" onClick={() => void shareLocalProject()} disabled={busy || !localProject || Boolean(localProject.cloudProjectId)}>Share project</button></div>
      {localProject?.cloudProjectId && <p className="manage-muted">This local project is linked to cloud project {localProject.cloudProjectId} (revision {localProject.cloudRevision ?? "unknown"}).</p>}
    </div>
    <div className="manage-panel">
      {loading && <p className="manage-muted" role="status">Loading shared projects…</p>}
      <div className="manage-panel-heading"><div><h3>Shared projects</h3><p>{sharedProjects.length} project(s) available to your account.</p></div><button className="manage-button secondary" type="button" onClick={() => void refreshShared()} disabled={busy}><RefreshCw size={14}/> Refresh</button></div>
      <label className="manage-project-select">Select shared project<select value={selectedCloudId} onChange={event => setSelectedCloudId(event.target.value)}><option value="">Choose a shared project</option>{sharedProjects.map(item => <option key={item.id} value={item.id}>{item.name} · r{item.revision}</option>)}</select></label>
      {selectedCloud && <>
        <div className="manage-project-meta"><span>Owner {selectedCloud.owner_id === user.id ? "(you)" : profileNames[selectedCloud.owner_id] ?? selectedCloud.owner_id}</span><span>Revision {selectedCloud.revision}</span><span>Your role: {myRole ?? "member"}</span></div>
        <div className="manage-inline-form"><label>Local project for sync<select value={localProjectId} onChange={event => setLocalProjectId(event.target.value)}><option value="">Select local project</option>{localProjects.map(item => <option key={item.id} value={item.id}>{item.name || "Untitled project"}</option>)}</select></label><div className="manage-actions"><button type="button" className="manage-button secondary" onClick={() => void pullCloudChanges()} disabled={busy || !localProject}>Pull cloud version</button><button type="button" className="manage-button" onClick={() => void pushLocalChanges()} disabled={busy || !localProject || !canEdit || localProject.cloudProjectId !== selectedCloud.id}>Push local changes</button></div></div>
      </>}
    </div>
    {selectedCloud && <>
      <div className="manage-panel">
        <div className="manage-panel-heading"><div><h3><Users size={16}/> Collaborators</h3><p>Only the project owner can add, change or remove members.</p></div></div>
        {members.map(member => <div className="manage-member" key={member.user_id}><div><strong>{profileNames[member.user_id] ?? member.user_id}</strong><small>{member.user_id}</small></div>{canManageMembers && member.role !== "owner" ? <div className="manage-member-actions"><select aria-label={`Role for ${member.user_id}`} value={member.role} onChange={event => void changeMemberRole(member, event.target.value as "editor" | "viewer")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button type="button" className="manage-text-button danger" onClick={() => void removeMember(member)}>Remove</button></div> : <span className="manage-role">{member.role}</span>}</div>)}
        {canManageMembers && <form className="manage-inline-form" onSubmit={addMember}><label>Existing account UUID<input value={memberId} onChange={event => setMemberId(event.target.value)} placeholder="Ask collaborator for their account ID" required/></label><label>Role<select value={memberRole} onChange={event => setMemberRole(event.target.value as "editor" | "viewer")}><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button className="manage-button" type="submit" disabled={busy}>Add collaborator</button></form>}
        {!canManageMembers && <p className="manage-muted">Ask the project owner to manage membership. Share your account ID from Settings if you need to be added.</p>}
      </div>
      <div className="manage-panel">
        <div className="manage-panel-heading"><div><h3><MessageSquare size={16}/> Discussion</h3><p>Project-level comments and resolution tracking.</p></div></div>
        {canEdit && <form className="manage-comment-form" onSubmit={postComment}><textarea rows={3} value={commentBody} onChange={event => setCommentBody(event.target.value)} placeholder="Add a research comment or question…" maxLength={10000}/><button className="manage-button" type="submit" disabled={busy || !commentBody.trim()}>Post comment</button></form>}
        {comments.map(comment => <article className={`manage-comment ${comment.resolved_at ? "is-resolved" : ""}`} key={comment.id}><div className="manage-comment-meta"><strong>{profileNames[comment.author_id] ?? comment.author_id}</strong><time>{new Date(comment.created_at).toLocaleString()}</time></div><p>{comment.body}</p><div className="manage-comment-footer"><span>{comment.resolved_at ? "Resolved" : "Open"}</span>{canEdit && <button type="button" className="manage-text-button" onClick={() => void resolveComment(comment)}>{comment.resolved_at ? "Reopen" : "Resolve"}</button>}</div></article>)}
        {comments.length === 0 && <p className="manage-muted">No comments yet.</p>}
      </div>
      <div className="manage-panel">
        <div className="manage-panel-heading"><div><h3><Activity size={16}/> Activity and versions</h3><p>Recent shared-project activity and immutable revision snapshots.</p></div></div>
        <div className="manage-two-column"><div><h4>Recent activity</h4>{activity.map(item => <div className="manage-timeline" key={item.id}><span>{item.summary}</span><small>{new Date(item.created_at).toLocaleString()}</small></div>)}{activity.length === 0 && <p className="manage-muted">No activity recorded.</p>}</div><div><h4>Version history</h4>{versions.map(item => <div className="manage-timeline" key={item.id}><span>Revision {item.revision}</span><small>{item.author_id ? profileNames[item.author_id] ?? item.author_id : "System"} · {new Date(item.created_at).toLocaleString()}</small></div>)}{versions.length === 0 && <p className="manage-muted">No versions available.</p>}</div></div>
      </div>
    </>}
    <p className="manage-security-note"><Shield size={14}/> Shared records are protected by Supabase Row Level Security. This workspace uses manual refresh because Realtime replication is not enabled for the current project tables.</p>
  </section>;
}
