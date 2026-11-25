-- Phase 7 security and index hardening.
-- This migration is intentionally additive and matches the dedicated
-- PaperOrchestra Supabase project migration history.

-- Keep public RPC entry points SECURITY INVOKER. Privileged writes are
-- isolated in non-exposed private-schema implementations.
create or replace function private.create_shared_project_impl(
  p_name text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  safe_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 180 then
    raise exception 'Invalid project name' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_payload) <> 'object' then
    raise exception 'Project payload must be a JSON object' using errcode = '22023';
  end if;

  insert into public.shared_projects(owner_id, name, payload)
  values (auth.uid(), trim(p_name), safe_payload)
  returning id into new_id;

  insert into public.project_members(project_id, user_id, role, added_by)
  values (new_id, auth.uid(), 'owner', auth.uid());

  insert into public.project_versions(project_id, revision, author_id, payload)
  values (new_id, 1, auth.uid(), safe_payload);

  insert into public.project_activity(project_id, actor_id, event_type, summary)
  values (new_id, auth.uid(), 'project.created', 'Created shared project');

  return new_id;
end;
$$;

create or replace function private.update_shared_project_impl(
  p_project_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
  current_name text;
  caller_is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_is_owner := private.has_project_role(p_project_id, array['owner']);
  if not caller_is_owner
     and not private.has_project_role(p_project_id, array['editor']) then
    raise exception 'Project edit permission required' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Project payload must be a JSON object' using errcode = '22023';
  end if;

  select sp.name into current_name
  from public.shared_projects sp
  where sp.id = p_project_id;

  if current_name is null then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if caller_is_owner then
    if char_length(trim(coalesce(p_name, ''))) not between 1 and 180 then
      raise exception 'Invalid project name' using errcode = '22023';
    end if;
  elsif p_name is distinct from current_name then
    raise exception 'Only the project owner can rename a shared project' using errcode = '42501';
  end if;

  update public.shared_projects
  set name = case when caller_is_owner then trim(p_name) else name end,
      payload = p_payload,
      revision = revision + 1,
      updated_at = now()
  where id = p_project_id and revision = p_expected_revision
  returning revision into next_revision;

  if next_revision is null then
    raise exception 'Revision conflict: project changed remotely. Refresh and compare versions.'
      using errcode = '40001';
  end if;

  insert into public.project_versions(project_id, revision, author_id, payload)
  select sp.id, sp.revision, auth.uid(), sp.payload
  from public.shared_projects sp
  where sp.id = p_project_id;

  insert into public.project_activity(project_id, actor_id, event_type, summary, metadata)
  values (
    p_project_id, auth.uid(), 'project.updated', 'Updated shared project',
    jsonb_build_object('revision', next_revision)
  );

  return next_revision;
end;
$$;

revoke all on function private.create_shared_project_impl(text, jsonb) from public, anon;
revoke all on function private.update_shared_project_impl(uuid, bigint, text, jsonb) from public, anon;
grant execute on function private.create_shared_project_impl(text, jsonb) to authenticated;
grant execute on function private.update_shared_project_impl(uuid, bigint, text, jsonb) to authenticated;

create or replace function public.create_shared_project(
  p_name text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_shared_project_impl(p_name, p_payload);
$$;

create or replace function public.update_shared_project(
  p_project_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_payload jsonb
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.update_shared_project_impl(p_project_id, p_expected_revision, p_name, p_payload);
$$;

revoke all on function public.create_shared_project(text, jsonb) from public, anon;
revoke all on function public.update_shared_project(uuid, bigint, text, jsonb) from public, anon;
grant execute on function public.create_shared_project(text, jsonb) to authenticated;
grant execute on function public.update_shared_project(uuid, bigint, text, jsonb) to authenticated;

-- Prevent an owner from changing the identity/project of an existing
-- membership row through UPDATE. Role changes are still permitted.
create or replace function private.guard_project_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.user_id is distinct from old.user_id
     or new.added_by is distinct from old.added_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Membership identity and provenance cannot be changed' using errcode = '42501';
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'The owner membership cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_project_member_update() from public, anon, authenticated;
drop trigger if exists guard_project_member_update on public.project_members;
create trigger guard_project_member_update
  before update on public.project_members
  for each row execute function private.guard_project_member_update();

-- Cover foreign-key lookups and deletes.
create index if not exists shared_projects_owner_idx on public.shared_projects(owner_id);
create index if not exists project_members_added_by_idx on public.project_members(added_by);
create index if not exists project_comments_author_idx on public.project_comments(author_id);
create index if not exists project_comments_parent_idx on public.project_comments(parent_id);
create index if not exists project_comments_resolved_by_idx on public.project_comments(resolved_by);
create index if not exists project_activity_actor_idx on public.project_activity(actor_id);
create index if not exists project_versions_author_idx on public.project_versions(author_id);
