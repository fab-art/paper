-- Phase 7 membership immutability and reply-index hardening.
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

create index if not exists project_comments_project_parent_idx
  on public.project_comments(project_id, parent_id);
