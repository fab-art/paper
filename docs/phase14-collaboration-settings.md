# Phase 14 — Collaboration and Settings

## Collaboration

Cloud collaboration is optional and remains separate from the default local-first workspace.

- Sign in with Supabase Auth email magic links (PKCE).
- Explicitly create a cloud copy from a selected local project.
- Push and pull project snapshots manually with optimistic cloud revision checks.
- The existing Supabase schema and RPCs manage shared projects, membership, activity and immutable versions.
- Owners can add an existing PaperOrchestra account by UUID as editor or viewer, change non-owner roles and remove non-owner members.
- Editors can push project changes and comment; viewers are read-only.
- Members can post project comments and editors/owners can resolve or reopen them.
- View recent activity and version snapshots.
- RLS remains the authorization boundary; no service-role key is used in the browser.
- The current database has no project invitation table or email-invite RPC. The workspace therefore adds existing accounts by UUID rather than pretending to send invitations. Users can copy their account UUID from Settings.
- Realtime publication is not enabled for the collaboration tables, so the UI uses explicit refresh instead of claiming live synchronization.

## Cloud payload boundaries

Sharing is an explicit action. The payload contains project research records but excludes local execution logs, model agent records, template files, figure binary assets, IndexedDB revision metadata and local archive/cloud-link fields. Separately stored attachments and notes are not uploaded.

Cloud sync is manual. Editors cannot rename a shared project through the RPC; owner-only naming is enforced server-side. Revision conflicts require refresh and comparison rather than last-write-wins.

## Settings

- Theme preference (light/dark), saved locally.
- Supabase account sign-in, display name and account UUID.
- Explicit privacy and storage behavior.
- JSON backup export for project records, with a clear note that separately stored attachments and notes are excluded.

## Supabase project findings

The dedicated PaperOrchestra Supabase project is active and already contains the Phase 7 collaboration tables and RPCs. All public collaboration tables have RLS enabled. Existing policies constrain shared project access to members, membership management to owners, and comment creation to owners/editors. No new database schema or service-role secret is introduced in this phase.

The security advisor currently reports that leaked-password protection is disabled for Auth. This is a dashboard security setting and should be enabled by the project administrator.

## Verification

- Unit tests cover cloud payload minimization, role permissions, member assignment validation, local/cloud identity preservation and comment validation.
- Workspace route tests require Collaboration and Settings to be active.
- Vercel Preview typecheck, tests and production build are release gates.
- Limrun interactive acceptance remains pending due to organization billing/credits.
