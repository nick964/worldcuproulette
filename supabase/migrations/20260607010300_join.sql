-- Invite/join flow. A user joining by invite code is not yet a group member,
-- so RLS hides the group from them. These SECURITY DEFINER functions let them
-- preview and join a group by its invite code without broadening RLS.

-- Lightweight preview of a group by invite code (name + member count).
create or replace function group_preview(p_code text)
returns table (id uuid, name text, member_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.name, count(gm.user_id)
  from groups g
  left join group_members gm on gm.group_id = g.id
  where g.invite_code = p_code
  group by g.id, g.name;
$$;

-- Join the group identified by invite code as the current user. Idempotent.
-- Returns the group id (or null if the code is invalid).
create or replace function join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := current_clerk_id();
  v_group  uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_group from groups where invite_code = p_code;
  if v_group is null then
    return null;
  end if;

  insert into group_members (group_id, user_id, role)
  values (v_group, v_caller, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

grant execute on function group_preview(text) to authenticated;
grant execute on function join_group(text)    to authenticated;
