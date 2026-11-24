-- Phase 7 follow-up: enforce true resolution transitions, server timestamps,
-- safe inviter deletion, and acyclic same-project comment threads.

create or replace function private.guard_project_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Membership identity and creation time cannot be changed' using errcode = '42501';
  end if;

  if new.added_by is distinct from old.added_by then
    -- Auth user deletion performs the FK's ON DELETE SET NULL action outside
    -- an end-user JWT context. Ordinary clients cannot erase inviter history.
    if not (old.added_by is not null and new.added_by is null and auth.uid() is null) then
      raise exception 'Membership inviter provenance cannot be changed' using errcode = '42501';
    end if;
  end if;

  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'The owner membership cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

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

    if new.resolved_at is distinct from old.resolved_at then
      if old.resolved_at is null and new.resolved_at is not null then
        -- Only a NULL -> non-NULL state transition resolves a comment.
        -- Ignore client-supplied time and actor.
        new.resolved_at := now();
        new.resolved_by := auth.uid();
      elsif old.resolved_at is not null and new.resolved_at is null then
        -- A non-NULL -> NULL transition reopens the comment.
        new.resolved_at := null;
        new.resolved_by := null;
      else
        raise exception 'A resolved comment cannot be re-resolved without reopening it first'
          using errcode = '42501';
      end if;
    elsif new.resolved_by is distinct from old.resolved_by then
      raise exception 'Resolver cannot change without a resolution-state transition'
        using errcode = '42501';
    end if;

    new.updated_at := now();
  end if;

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A comment cannot be its own parent' using errcode = '23514';
    end if;

    select c.project_id into parent_project_id
    from public.project_comments c
    where c.id = new.parent_id;

    if parent_project_id is null or parent_project_id is distinct from new.project_id then
      raise exception 'A reply must belong to the same project as its parent comment'
        using errcode = '23514';
    end if;

    -- Reject links to descendants, which would create a cycle in the reply tree.
    if exists (
      with recursive descendants(id) as (
        select c.id
        from public.project_comments c
        where c.parent_id = new.id and c.project_id = new.project_id
        union
        select child.id
        from public.project_comments child
        join descendants parent on child.parent_id = parent.id
        where child.project_id = new.project_id
      )
      select 1 from descendants where id = new.parent_id
    ) then
      raise exception 'A comment cannot be parented beneath one of its descendants'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
