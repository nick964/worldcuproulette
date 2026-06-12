-- Early first spin: members may draw ONE team while the pool is still open
-- (the moment they join), instead of waiting for lock. Safe because pools cap
-- at 48 members, so every member's final allotment is always >= 1. Remaining
-- spins unlock at lock (allotments count early picks: spins = allotted-used).
--
-- Consequences handled here:
--   * assign_random_team works pre-lock with an entitlement of 1
--   * leaving / being kicked before lock releases the early pick to the pot
--   * lock_pool completes immediately in the corner case where every team
--     was already claimed by early spins (48 members, all spun)

-- Spin: open pools allow exactly one pick; locked pools use the allotment.
-- The pool_members row is locked FOR UPDATE to serialize concurrent spins by
-- the same member (prevents double-draws from parallel requests).
create or replace function assign_random_team(p_pool_id uuid)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   text := current_clerk_id();
  v_status   text;
  v_allotted int;
  v_entitled int;
  v_used     int;
  v_team     teams;
  v_total    int;
  v_attempts int := 0;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select status into v_status from pools where id = p_pool_id;
  if v_status is null then
    raise exception 'Pool not found';
  end if;
  if v_status = 'complete' then
    raise exception 'Pool draft is already complete';
  end if;

  select teams_allotted into v_allotted
  from pool_members
  where pool_id = p_pool_id and user_id = v_caller
  for update;
  if v_allotted is null then
    raise exception 'You are not a member of this pool';
  end if;

  if v_status = 'open' then
    v_entitled := 1;  -- the guaranteed early spin
  else
    v_entitled := v_allotted;
  end if;

  select count(*) into v_used
  from picks where pool_id = p_pool_id and user_id = v_caller;
  if v_used >= v_entitled then
    if v_status = 'open' then
      raise exception 'You''ve taken your first spin — the rest unlock when the pool is locked';
    end if;
    raise exception 'No spins remaining';
  end if;

  loop
    v_attempts := v_attempts + 1;

    select t.* into v_team
    from teams t
    where t.id not in (select team_id from picks where pool_id = p_pool_id)
    order by random()
    limit 1;

    if v_team.id is null then
      raise exception 'No teams remaining in this pool';
    end if;

    begin
      insert into picks (pool_id, user_id, team_id)
      values (p_pool_id, v_caller, v_team.id);
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then
        raise exception 'Could not assign a team after % attempts', v_attempts;
      end if;
    end;
  end loop;

  if v_status = 'locked' then
    select count(*) into v_total from picks where pool_id = p_pool_id;
    if v_total >= 48 then
      update pools set status = 'complete' where id = p_pool_id;
    end if;
  end if;

  return v_team;
end;
$$;

-- Leave an open pool, releasing any early pick back into the pot.
create or replace function leave_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := current_clerk_id();
  v_owner  text;
  v_status text;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id, status into v_owner, v_status from pools where id = p_pool_id;
  if v_owner is null then
    raise exception 'Pool not found';
  end if;
  if v_status <> 'open' then
    raise exception 'You can only leave while the pool is open';
  end if;
  if v_caller = v_owner then
    raise exception 'The owner can''t leave their own pool — delete it instead';
  end if;

  delete from picks where pool_id = p_pool_id and user_id = v_caller;
  delete from pool_members where pool_id = p_pool_id and user_id = v_caller;
  if not found then
    raise exception 'You are not a member of this pool';
  end if;
end;
$$;

-- Kick now also releases the member's early pick (kick is open-pools-only).
create or replace function kick_member(p_pool_id uuid, p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := current_clerk_id();
  v_owner  text;
  v_status text;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id, status into v_owner, v_status from pools where id = p_pool_id;
  if v_owner is null then
    raise exception 'Pool not found';
  end if;
  if v_owner <> v_caller then
    raise exception 'Only the pool owner can remove members';
  end if;
  if v_status <> 'open' then
    raise exception 'Members can only be removed while the pool is open';
  end if;
  if p_user_id = v_owner then
    raise exception 'The owner cannot be removed from their own pool';
  end if;

  delete from picks where pool_id = p_pool_id and user_id = p_user_id;
  delete from pool_members where pool_id = p_pool_id and user_id = p_user_id;
  if not found then
    raise exception 'That user is not a member of this pool';
  end if;
end;
$$;

-- Lock: unchanged distribution, plus the corner case where early spins
-- already claimed all 48 teams (pool completes instantly).
create or replace function lock_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := current_clerk_id();
  v_status text;
  v_owner  text;
  v_count  int;
  v_base   int;
  v_rem    int;
  v_extra  text[];
  v_picked int;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select status, owner_id into v_status, v_owner from pools where id = p_pool_id;
  if v_owner is null then
    raise exception 'Pool not found';
  end if;
  if v_owner <> v_caller then
    raise exception 'Only the pool owner can lock the pool';
  end if;
  if v_status <> 'open' then
    raise exception 'Pool is not open';
  end if;

  select count(*) into v_count from pool_members where pool_id = p_pool_id;
  if v_count < 1 then
    raise exception 'Pool needs at least one member to lock';
  end if;
  if v_count > 48 then
    raise exception 'Pool has more than 48 members; cannot distribute 48 teams';
  end if;

  v_base := 48 / v_count;
  v_rem  := 48 % v_count;

  select array(
    select user_id from pool_members
    where pool_id = p_pool_id
    order by random()
    limit v_rem
  ) into v_extra;

  update pool_members pm
  set teams_allotted = v_base + case when pm.user_id = any(v_extra) then 1 else 0 end
  where pm.pool_id = p_pool_id;

  update pools set status = 'locked' where id = p_pool_id;

  select count(*) into v_picked from picks where pool_id = p_pool_id;
  if v_picked >= 48 then
    update pools set status = 'complete' where id = p_pool_id;
  end if;
end;
$$;

grant execute on function leave_pool(uuid) to authenticated;
