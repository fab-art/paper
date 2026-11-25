# Phase 2 — Project Workspace Migration

**Status:** Draft plan, stacked on Phase 1  
**Target branch:** `feat/research-factory-phase2-project-workspace`  
**Product rule:** One project, one local source of truth. The workspace may improve presentation and workflows, but it must not fork the data model.

## 1. Outcome

Move the existing project workspace into the independent Research Factory frontend. A researcher can create a project, open it, understand its current state, maintain notes and sources, attach files, track milestones, and manage its lifecycle without returning to the legacy UI.

The migration is staged. Phase 2 does not migrate the literature, systematic-review, Data & Methods, Writing Studio, or Quality & Export engines. Those remain separate stations and are migrated in later phases.

## 2. User-facing scope

### Project overview
- Editable project title and research question.
- Objectives, methodology, paper type, audience and available materials.
- Project status: Planning, Active, On hold, Completed.
- Milestones with due dates and explicit completion state.
- Last-saved state, local-storage state and conflict messaging.

### Research library
- List project papers with title, authors, year, venue, DOI and source.
- Search/filter by title, author, DOI and venue.
- Add a source manually.
- Prevent duplicate saves by normalized DOI or title.
- Preserve the existing `Paper` record shape.

### Notes
- List, create, edit and delete project notes.
- Keep note identity and timestamps stable.
- Show saved/error state; never report success before IndexedDB confirms the write.

### Files
- Upload files to the existing IndexedDB attachments store.
- Preserve the current 30 MB per-file limit.
- Show file name, type, size and date; support download and delete.
- Do not silently upload attachments to Supabase.

### Project lifecycle
- Create from the existing research-intake builder.
- Archive without deleting project data.
- Restore archived projects.
- Permanently delete only after explicit confirmation; use the existing tombstone and transactional cascade.
- Keep archive, restore and permanent delete as distinct actions.

## 3. Architecture and contracts

### Route contract
- `/projects` — project library.
- `/projects/:projectId` — project workspace.
- Workspace stations remain separate routes and receive the current project context.
- Browser back/forward and direct route refresh must work.

### Repository boundary

Create a typed application adapter under `apps/web/src/features/projects/`. It may call existing IndexedDB services, but UI components must not import Dexie or access tables directly.

Required operations:
- `listProjects()`
- `getProject(projectId)`
- `createProject(input)`
- `saveProjectSnapshot(project)`
- `archiveProject(projectId, expectedRevision)`
- `restoreArchivedProject(project)`
- `permanentlyDeleteProject(projectId, expectedRevision)`
- `listNotes(projectId)`, `saveNote(note)`, `deleteNote(projectId, noteId)`
- `listAttachments(projectId)`, `saveAttachment(attachment)`, `deleteAttachment(projectId, attachmentId)`

Keep input and output types explicit. Use the existing `Project`, `Paper`, `ProjectNote`, `ProjectAttachment`, `ResearchMilestone` and `ProjectStatus` contracts. Avoid a parallel project JSON model.

### Save and concurrency contract
- Reuse `saveProject`, `assertProjectRevision`, `assertProjectWritable`, `projectFingerprint` and `shouldSaveProjectSnapshot`.
- Serialize autosave writes per project.
- A stale snapshot must never adopt a newer revision and overwrite newer content.
- Surface cross-tab revision conflicts and tombstone/deleted-project errors; do not silently retry by overwriting.
- Note and attachment deletion must validate project writability in the same transaction. The legacy delete helpers do not currently accept a project ID, so add guarded wrappers rather than using them directly from the UI.
- Permanent deletion must call `deleteProjectAndData(projectId, expectedRevision)` and must not be implemented as a sequence of independent table deletes.

### Lumen integration
- Continue using the pinned `@santi020k/lumen-react@4.3.0` adapter and its installed public types.
- Use Lumen Tabs for workspace sections, Card for distinct content surfaces, Button for actions, and the installed-version dialog/alert-dialog primitives for focused and destructive flows.
- Do not copy the Lumen catalog's 5.3.0 contracts into this 4.3.0 consumer. Every import and prop must pass the actual app TypeScript/build gate.

## 4. TDD sequence

1. **Repository contract tests (RED):** create/update, expected-revision conflicts, archived state, restore, tombstones, note/attachment ownership, duplicate paper detection.
2. **Repository implementation (GREEN):** thin wrappers around the existing IndexedDB services; no schema changes.
3. **Autosave controller tests:** serialized snapshots, stale-snapshot rejection, error recovery and project-switch isolation.
4. **Project overview UI:** load, empty/missing, populated, saving, saved, conflict and storage-error states.
5. **Notes and library UI:** CRUD and duplicate prevention with IndexedDB integration tests.
6. **Files and milestones UI:** size validation, download/delete, milestone add/toggle and persistence.
7. **Lifecycle UI:** create, archive, restore and permanent-delete confirmation.
8. **Browser regression:** direct route, refresh, back/forward, keyboard, reduced motion, light/dark, 320–1440px, WCAG 2.2 A/AA.
9. **Release:** root regression suite, app unit/browser suite, audit, TypeScript, Vite build and isolated Vercel Preview on the same commit.

## 5. Non-regression rules

- No Dexie schema/version changes in this phase.
- No project ID regeneration or record-shape migration.
- No Supabase writes or background synchronization.
- No automatic deletion of archived data.
- No permanent deletion without a clear confirmation that identifies the project and scope of deleted data.
- No silent autosave conflict resolution.
- Keep the legacy frontend available until all later stations pass feature parity.

## 6. Acceptance criteria

- Existing local projects open in the new workspace with their original IDs and data.
- New projects are saved using the canonical existing `saveProject` path.
- Autosave is revision-aware and race-safe.
- Notes, papers, attachments and milestones survive reload.
- Archive/restore preserves data; permanent delete removes dependent records transactionally and leaves a tombstone.
- Browser back/forward and direct route refresh work.
- Keyboard and screen-reader labels are clear; dialogs trap and restore focus.
- All light/dark, responsive, regression, security, build and Vercel Preview gates pass.

## 7. Explicitly out of scope

- Rewriting the literature discovery engine.
- Rewriting Writing Studio or WebLLM/local compute.
- Rewriting Data & Methods or worker execution.
- Rewriting systematic-review screening, extraction or risk-of-bias logic.
- Rewriting Quality & Export or submission compilation.
- Enabling cloud collaboration or changing Supabase RLS.
