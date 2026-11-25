-- PaperOrchestra Phase 7 collaboration foundation.
-- Additive, opt-in cloud collaboration. Existing IndexedDB projects are untouched.
-- Apply only to the dedicated PaperOrchestra Supabase project after review.

create extension if not exists pgcrypto;

-- Authorization helpers live outside the exposed Data API schemas.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 180),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.shared_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.shared_projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  parent_id uuid references public.project_comments(id) on delete cascade,
  resource_type text not null default 'project',
  resource_id text,
  body text not null check (char_length(body) between 1 and 10000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_activity (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.shared_projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.shared_projects(id) on delete cascade,
  revision bigint not null,
  author_id uuid references auth.users(id) on delete set null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

create index if not exists project_members_user_idx on public.project_members(user_id);
create index if not exists project_comments_project_created_idx on public.project_comments(project_id, created_at desc);
create index if not exists project_activity_project_created_idx on public.project_activity(project_id, created_at desc);
create index if not exists project_versions_project_revision_idx on public.project_versions(project_id, revision desc);

-- These SECURITY DEFINER helpers bypass membership-table RLS only for the
-- narrow membership lookup. Identity always comes from auth.uid().
create or replace function private.is_project_member(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = p_project_id and pm.user_id = auth.uid()
    );
$$;

create or replace function private.has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = auth.uid()
        and pm.role = any(p_roles)
    );
$$;

revoke all on function private.is_project_member(uuid) from public, anon;
revoke all on function private.has_project_role(uuid, text[]) from public, anon;
grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function private.has_project_role(uuid, text[]) to authenticated;

-- A profile is created at signup. User metadata is display-only, never authz.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    )), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_paperorchestra on auth.users;
create trigger on_auth_user_created_paperorchestra
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Atomic project creation: caller becomes owner in the same transaction.
create or replace function public.create_shared_project(
  p_name text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer
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

-- Editors may update project content but only owners may rename metadata.
-- Revision comparison makes concurrent writes fail instead of overwriting.
create or replace function public.update_shared_project(
  p_project_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_payload jsonb
)
returns bigint
language plpgsql security definer
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

revoke all on function public.create_shared_project(text, jsonb) from public, anon;
revoke all on function public.update_shared_project(uuid, bigint, text, jsonb) from public, anon;
grant execute on function public.create_shared_project(text, jsonb) to authenticated;
grant execute on function public.update_shared_project(uuid, bigint, text, jsonb) to authenticated;

-- Comment author, project and id cannot be changed; resolution actor must be
-- the authenticated user who made the resolution change.
create or replace function private.guard_project_comment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.project_id is distinct from old.project_id
     or new.author_id is distinct from old.author_id then
    raise exception 'Comment identity and project cannot be changed' using errcode = '42501';
  end if;

  if new.resolved_by is distinct from old.resolved_by
     and new.resolved_by is distinct from auth.uid() then
    raise exception 'Resolution actor must be the current user' using errcode = '42501';
  end if;

  if new.resolved_at is distinct from old.resolved_at
     and new.resolved_at is not null
     and new.resolved_by is distinct from auth.uid() then
    raise exception 'Resolution actor must be the current user' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_project_comment_update() from public, anon, authenticated;
drop trigger if exists guard_project_comment_update on public.project_comments;
create trigger guard_project_comment_update
  before update on public.project_comments
  for each row execute function private.guard_project_comment_update();

alter table public.profiles enable row level security;
alter table public.shared_projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_comments enable row level security;
alter table public.project_activity enable row level security;
alter table public.project_versions enable row level security;

create policy "profiles readable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users insert own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "members read shared projects"
  on public.shared_projects for select to authenticated
  using (private.is_project_member(id));
create policy "owner deletes shared project"
  on public.shared_projects for delete to authenticated
  using (private.has_project_role(id, array['owner']));

create policy "members read membership"
  on public.project_members for select to authenticated
  using (private.is_project_member(project_id));
create policy "owners add members"
  on public.project_members for insert to authenticated
  with check (
    private.has_project_role(project_id, array['owner'])
    and role in ('editor', 'viewer')
    and user_id <> (select auth.uid())
  );
create policy "owners change non-owner members"
  on public.project_members for update to authenticated
  using (private.has_project_role(project_id, array['owner']) and role <> 'owner')
  with check (
    private.has_project_role(project_id, array['owner'])
    and role in ('editor', 'viewer')
    and user_id <> (select auth.uid())
  );
create policy "owners remove non-owner members"
  on public.project_members for delete to authenticated
  using (private.has_project_role(project_id, array['owner']) and role <> 'owner');

create policy "members read comments"
  on public.project_comments for select to authenticated
  using (private.is_project_member(project_id));
create policy "editors create comments"
  on public.project_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.has_project_role(project_id, array['owner', 'editor'])
  );
create policy "current editors or owners update comments"
  on public.project_comments for update to authenticated
  using (
    (author_id = (select auth.uid())
      and private.has_project_role(project_id, array['owner', 'editor']))
    or private.has_project_role(project_id, array['owner'])
  )
  with check (
    (author_id = (select auth.uid())
      and private.has_project_role(project_id, array['owner', 'editor']))
    or private.has_project_role(project_id, array['owner'])
  );
create policy "current editors or owners delete comments"
  on public.project_comments for delete to authenticated
  using (
    (author_id = (select auth.uid())
      and private.has_project_role(project_id, array['owner', 'editor']))
    or private.has_project_role(project_id, array['owner'])
  );

create policy "members read activity"
  on public.project_activity for select to authenticated
  using (private.is_project_member(project_id));
create policy "members read versions"
  on public.project_versions for select to authenticated
  using (private.is_project_member(project_id));

-- Explicit least-privilege Data API grants; RLS is still the row boundary.
grant select, insert, update on public.profiles to authenticated;
grant select, delete on public.shared_projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.project_comments to authenticated;
grant select on public.project_activity, public.project_versions to authenticated;

-- Private object path: {project_uuid}/{uploader_user_uuid}/{file_uuid}/{filename}
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do update
set public = false, file_size_limit = 52428800;

create policy "project members read shared files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and array_length(storage.foldername(name), 1) >= 3
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_project_member(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy "editors upload own project files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and array_length(storage.foldername(name), 1) >= 3
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2] = (select auth.uid())::text
        and private.has_project_role(((storage.foldername(name))[1])::uuid, array['owner', 'editor'])
      else false
    end
  );

-- Upsert needs SELECT + INSERT + UPDATE. Replacement is limited to the uploader.
create policy "editors replace own project files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-files'
    and array_length(storage.foldername(name), 1) >= 3
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2] = (select auth.uid())::text
        and private.has_project_role(((storage.foldername(name))[1])::uuid, array['owner', 'editor'])
      else false
    end
  )
  with check (
    bucket_id = 'project-files'
    and array_length(storage.foldername(name), 1) >= 3
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2] = (select auth.uid())::text
        and private.has_project_role(((storage.foldername(name))[1])::uuid, array['owner', 'editor'])
      else false
    end
  );

create policy "owners or uploaders delete project files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and array_length(storage.foldername(name), 1) >= 3
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_project_role(((storage.foldername(name))[1])::uuid, array['owner'])
        or (
          (storage.foldername(name))[2] = (select auth.uid())::text
          and private.has_project_role(((storage.foldername(name))[1])::uuid, array['editor'])
        )
      else false
    end
  );

-- Activity and version rows have no direct client write policy.
