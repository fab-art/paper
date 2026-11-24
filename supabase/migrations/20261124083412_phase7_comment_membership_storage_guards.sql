-- Phase 7 follow-up: correct resolver transitions, server timestamps,
-- immutable membership provenance, and case-insensitive Storage cleanup.

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
    -- Client-supplied timestamps cannot alter activity ordering.
    new.created_at := now();
    new.updated_at := now();
  else
    if new.id is distinct from old.id
       or new.project_id is distinct from old.project_id
       or new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Comment identity, authorship, project and creation time cannot be changed'
        using errcode = '42501';
    end if;

    -- Resolver attribution can change only during a real resolve/reopen
    -- transition. Reopening clears both fields; resolving stamps auth.uid().
    if new.resolved_at is distinct from old.resolved_at then
      if new.resolved_at is null then
        if new.resolved_by is not null then
          raise exception 'Reopening a comment must clear its resolver' using errcode = '42501';
        end if;
      elsif new.resolved_by is distinct from auth.uid() then
        raise exception 'Resolution actor must be the current user' using errcode = '42501';
      end if;
    elsif new.resolved_by is distinct from old.resolved_by then
      raise exception 'Resolver cannot change without a resolution transition' using errcode = '42501';
    end if;

    new.updated_at := now();
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

drop policy if exists "owners add members" on public.project_members;
create policy "owners add members"
  on public.project_members for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and private.has_project_role(project_id, array['owner'])
    and role in ('editor', 'viewer')
    and user_id <> (select auth.uid())
  );

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
      and lower((storage.foldername(o.name))[1]) = lower(old.id::text)
  ) then
    raise exception 'Delete project attachments from private Storage before deleting this project'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

revoke all on function private.prevent_project_delete_with_files() from public, anon, authenticated;
