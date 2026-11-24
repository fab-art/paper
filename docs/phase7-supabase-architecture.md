# Phase 7 — Supabase collaboration architecture

## Goals
Add opt-in, multi-user collaboration without replacing the existing browser-local workspace. Existing projects remain usable offline and without Supabase configuration. A project is published to a shared workspace only when its owner enables cloud collaboration.

## Architecture
- React/Vite PWA remains the client. An optional Supabase client is initialized only when the public project URL and publishable key are configured; otherwise the PWA remains local-only and the account control explains that cloud setup is pending.
- Supabase Auth provides identity (email/password and magic-link sign-in).
- Supabase Postgres stores shared project metadata, membership, comments, activity and version snapshots.
- Supabase Storage stores shared attachments in a private bucket.
- Row Level Security (RLS) is the authorization boundary. The browser uses only the publishable/anon key; never ship a service-role key.
- Dexie/IndexedDB remains the local cache and offline working copy. Supabase is the synchronization authority only for projects explicitly shared.
- A sync adapter maps local project records to a versioned cloud payload. It must not silently overwrite concurrent edits.

## Data model
- profiles: public display name/avatar metadata keyed to auth.users; a signup trigger creates the profile, and user metadata is never used for authorization.
- shared_projects: cloud project envelope, owner, name, JSONB project payload, monotonically increasing revision, updated timestamp.
- project_members: one row per user/project with owner/editor/viewer role.
- project_comments: anchored discussions against a document or project resource, with resolved state.
- project_activity: append-only audit events.
- project_versions: immutable project snapshots with author and revision.
- Storage bucket project-files (private, 50 MB per object): object path {project_id}/{uploader_id}/{opaque_file_id}/{safe_filename}; Storage RLS permits members to read, editors/owners to upload, uploaders to replace their own files, and owners (or current editors for their own uploads) to delete.

## Authorization rules
- Only authenticated users can read shared project data.
- Owners can update project metadata and membership; editors can update project payload and create comments; viewers are read-only.
- Members can read comments, activity and versions; editors/owners can write comments.
- Activity and version rows are insert-only to ordinary clients. No client can update/delete audit events.
- Project deletion is owner-only and cascades relational data. A database trigger blocks deletion while project files remain in private Storage; owners must remove attachments through Storage before deleting the cloud project.
- Membership removal immediately revokes access through RLS.
- Owner role is established atomically by the private server-side project-creation implementation and cannot be self-assigned by a client. Membership row identity/provenance is immutable after insertion.
- Avoid trusting user_metadata for authorization. Use auth.uid() and database rows only.

## Local-first synchronization
1. Existing project stays in IndexedDB; collaboration is off by default.
2. User signs in and explicitly selects Share project.
3. Create shared project and owner membership in one transaction/RPC; store returned cloud ID and revision locally.
4. Local edits remain durable in Dexie first. A sync queue then pushes a revision-checked update.
5. Use optimistic concurrency (expected_revision). If cloud revision differs, return a conflict; keep both local and cloud versions and ask the user to compare/resolve. Never last-write-wins silently.
6. Pull remote updates into a separate incoming state, then merge only when local revision is clean.
7. Offline edits are queued and retried on reconnect; UI shows Offline, Pending sync, Synced or Conflict.
8. Deleting local cache does not delete the shared cloud project. Cloud deletion is a separate explicit owner action.

## Phase 7 delivery slices
A. Foundation: auth, profile, Supabase client config, SQL migrations, RLS tests and environment documentation.
B. Sharing: project sharing dialog, member list, invitations by email through Supabase Auth, role management and revocation.
C. Sync: local-first outbox, revision checks, conflict resolution and status indicators.
D. Collaboration: comments/threads, activity timeline, immutable versions and restore.
E. Storage: private attachment upload/download with RLS-backed Storage policies.

## Required Vercel environment variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY (preferred; VITE_SUPABASE_ANON_KEY remains supported for compatibility)

These are public client configuration values, not secrets. Do not add service-role keys to Vercel frontend variables. Configure Auth redirect URLs for the production domain and Vercel preview domains in Supabase Auth settings.

## Rollout and safety
- Feature flag collaboration until Supabase is configured.
- No automatic migration of existing IndexedDB data.
- Existing local-only projects continue to work unchanged.
- Explicit consent before uploading any project data or attachments.
- Show a warning before sharing projects containing sensitive data.
- Keep the cloud schema additive; never remove Dexie fields or stores as part of initial rollout.
- Back up the Supabase project and test RLS with at least two distinct users (owner/editor/viewer) before enabling production sharing. Automated SQL checks confirm all six public tables have RLS, the private Storage bucket and four Storage policies exist, and public RPC wrappers are SECURITY INVOKER; real multi-user JWT tests remain required before production sharing.
- Test cross-project isolation, removed-member access, anonymous access denial, stale revision conflicts, offline queue recovery and attachment path traversal.
