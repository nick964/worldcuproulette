-- Owner moderation tools:
--   kick_member       — remove a member while the pool is still open
--   auto_draft_member — fill a slow member's remaining picks during the draft
-- Both SECURITY DEFINER with their own authorization, like the other RPCs.

-- Remove a member from an open pool. Owner only; the owner can't be removed.
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

  delete from pool_members where pool_id = p_pool_id and user_id = p_user_id;
  if not found then
    raise exception 'That user is not a member of this pool';
  end if;
end;
$$;

-- Assign all of a member's remaining teams at random, atomically. Owner only,
-- pool must be mid-draft (locked). Returns the number of teams assigned.
-- The unique (pool_id, team_id) constraint guards against concurrent spins;
-- on collision the whole insert retries with a fresh random selection.
create or replace function auto_draft_member(p_pool_id uuid, p_user_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   text := current_clerk_id();
  v_owner    text;
  v_status   text;
  v_allotted int;
  v_used     int;
  v_needed   int;
  v_total    int;
  v_attempts int := 0;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select owner_id, status into v_owner, v_status from pools where id = p_pool_id;
  if v_owner is null then
    raise exception 'Pool not found';
  end if;
  if v_owner <> v_caller then
    raise exception 'Only the pool owner can auto-draft a member';
  end if;
  if v_status <> 'locked' then
    raise exception 'Auto-draft is only available while the pool is drafting';
  end if;

  select teams_allotted into v_allotted
  from pool_members where pool_id = p_pool_id and user_id = p_user_id;
  if v_allotted is null then
    raise exception 'That user is not a member of this pool';
  end if;

  select count(*) into v_used
  from picks where pool_id = p_pool_id and user_id = p_user_id;
  v_needed := v_allotted - v_used;
  if v_needed <= 0 then
    raise exception 'That member has no spins remaining';
  end if;

  loop
    v_attempts := v_attempts + 1;
    begin
      insert into picks (pool_id, user_id, team_id)
      select p_pool_id, p_user_id, t.id
      from teams t
      where t.id not in (select team_id from picks where pool_id = p_pool_id)
      order by random()
      limit v_needed;
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then
        raise exception 'Could not auto-draft after % attempts', v_attempts;
      end if;
    end;
  end loop;

  select count(*) into v_total from picks where pool_id = p_pool_id;
  if v_total >= 48 then
    update pools set status = 'complete' where id = p_pool_id;
  end if;

  return v_needed;
end;
$$;

grant execute on function kick_member(uuid, text)       to authenticated;
grant execute on function auto_draft_member(uuid, text) to authenticated;
