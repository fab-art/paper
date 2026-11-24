-- Phase 7 review hardening: comments, membership identity, and Storage cleanup.
-- Comment replies must remain within the same project.
alter table public.project_comments
  add constraint project_comments_project_id_id_unique unique (project_id, id);

alter table public.project_comments
  add constraint project_comments_parent_same_project_fkey
  foreign key (project_id, parent_id)
  references public.project_comments(project_id, id)
  on delete cascade;

create or replace function private.guard_project_comment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_project_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid() then
      raise exception 'Comment author must be the current user' using errcode = '42501';
    end if;
    if new.resolved_at is not null or new.resolved_by is not null then
      raise exception 'New comments must start unresolved' using errcode = '42501';
    end if;
  else
    if new.id is distinct from old.id
       or new.project_id is distinct from old.project_id
       or new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Comment identity, authorship and project cannot be changed' using errcode = '42501';
    end if;

    if new.resolved_by is distinct from old.resolved_by
       and new.resolved_by is distinct from auth.uid() then
      raise exception 'Resolution actor must be the current user' using errcode = '42501';
    end if;

    if new.resolved_at is distinct from old.resolved_at then
      if new.resolved_at is not null and new.resolved_by is distinct from auth.uid() then
        raise exception 'Resolution actor must be the current user' using errcode = '42501';
      end if;
      if new.resolved_at is null and new.resolved_by is not null then
        raise exception 'An unresolved comment cannot have a resolver' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.parent_id is not null then
    select c.project_id into parent_project_id
    from public.project_comments c
    where c.id = new.parent_id;
    if parent_project_id is null or parent_project_id is distinct from new.project_id then
      raise exception 'A reply must belong to the same project as its parent comment'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_project_comment_write() from public, anon, authenticated;
drop trigger if exists guard_project_comment_update on public.project_comments;
drop trigger if exists guard_project_comment_write on public.project_comments;
create trigger guard_project_comment_write
  before insert or update on public.project_comments
  for each row execute function private.guard_project_comment_write();

-- Prevent deletion of a shared project while private Storage objects remain.
-- The owner must first delete files through Storage (while membership still exists).
create or replace function private.prevent_project_delete_with_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'project-files'
      and (storage.foldername(o.name))[1] = old.id::text
  ) then
    raise exception 'Delete project attachments from private Storage before deleting this project'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

revoke all on function private.prevent_project_delete_with_files() from public, anon, authenticated;
drop trigger if exists prevent_project_delete_with_files on public.shared_projects;
create trigger prevent_project_delete_with_files
  before delete on public.shared_projects
  for each row execute function private.prevent_project_delete_with_files();
