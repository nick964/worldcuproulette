-- Server-authoritative game logic. SECURITY DEFINER; each performs its own
-- authorization against current_clerk_id(). Call only from server actions.

-- Lock a pool: freeze membership and distribute all 48 team slots across the
-- members. base = floor(48/M); the remaining (48 mod M) extra slots go to
-- randomly chosen members.
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
end;
$$;

-- Atomically assign one random unclaimed team to the caller in a locked pool.
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
  if v_status = 'open' then
    raise exception 'Pool is not locked yet';
  end if;
  if v_status = 'complete' then
    raise exception 'Pool draft is already complete';
  end if;

  select teams_allotted into v_allotted
  from pool_members where pool_id = p_pool_id and user_id = v_caller;
  if v_allotted is null then
    raise exception 'You are not a member of this pool';
  end if;

  select count(*) into v_used
  from picks where pool_id = p_pool_id and user_id = v_caller;
  if v_used >= v_allotted then
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

  select count(*) into v_total from picks where pool_id = p_pool_id;
  if v_total >= 48 then
    update pools set status = 'complete' where id = p_pool_id;
  end if;

  return v_team;
end;
$$;

-- Owner records the World Cup winner; pool is marked complete.
create or replace function set_winning_team(p_pool_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := current_clerk_id();
  v_owner  text;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id into v_owner from pools where id = p_pool_id;
  if v_owner is null then
    raise exception 'Pool not found';
  end if;
  if v_owner <> v_caller then
    raise exception 'Only the pool owner can set the winning team';
  end if;

  update pools
  set winning_team_id = p_team_id,
      status = 'complete'
  where id = p_pool_id;
end;
$$;

grant execute on function lock_pool(uuid)              to authenticated;
grant execute on function assign_random_team(uuid)     to authenticated;
grant execute on function set_winning_team(uuid, uuid) to authenticated;
grant execute on function current_clerk_id()           to authenticated, anon;
grant execute on function is_pool_member(uuid)         to authenticated;
