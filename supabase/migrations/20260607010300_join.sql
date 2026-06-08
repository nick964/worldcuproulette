-- Invite/join flow. A user joining by invite code is not yet a pool member, so
-- RLS hides the pool from them. These SECURITY DEFINER functions let them
-- preview and join by invite code without broadening RLS.

-- Lightweight preview of a pool by invite code.
create or replace function pool_preview(p_code text)
returns table (id uuid, name text, status text, member_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.status, count(pm.user_id)
  from pools p
  left join pool_members pm on pm.pool_id = p.id
  where p.invite_code = p_code
  group by p.id, p.name, p.status;
$$;

-- Join the pool identified by invite code as the current user. Idempotent.
-- Returns the pool id, or null if the code is invalid. Blocks once a pool has
-- started (locked) or is full.
create or replace function join_pool(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := current_clerk_id();
  v_pool   uuid;
  v_status text;
  v_count  int;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select id, status into v_pool, v_status from pools where invite_code = p_code;
  if v_pool is null then
    return null;
  end if;

  -- Already a member → idempotent success.
  if exists (
    select 1 from pool_members where pool_id = v_pool and user_id = v_caller
  ) then
    return v_pool;
  end if;

  if v_status <> 'open' then
    raise exception 'This pool has already started; you can no longer join.';
  end if;

  select count(*) into v_count from pool_members where pool_id = v_pool;
  if v_count >= 48 then
    raise exception 'This pool is full (48 members max).';
  end if;

  insert into pool_members (pool_id, user_id, role) values (v_pool, v_caller, 'member');
  return v_pool;
end;
$$;

grant execute on function pool_preview(text) to authenticated;
grant execute on function join_pool(text)    to authenticated;
