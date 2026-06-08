-- Draft simulation test. Run in the Supabase SQL Editor AFTER applying the
-- migrations and seed. Wrapped in a transaction that rolls back, so it leaves
-- no data behind. It impersonates users by setting the JWT `sub` claim the same
-- way Supabase does at request time.
--
-- Asserts: a 7-member pool drafts all 48 teams, zero duplicates, and each
-- member's pick count equals their teams_allotted (sum = 48).

begin;

do $$
declare
  v_group  uuid := gen_random_uuid();
  v_pool   uuid := gen_random_uuid();
  v_user   text;
  v_i      int;
  v_allot  int;
  v_used   int;
  v_total  int;
  v_dupes  int;
  v_owner  text := 'sim_user_1';
begin
  -- Arrange: a group, a pool, and 7 members (inserted directly; editor bypasses RLS).
  insert into groups (id, name, owner_id, invite_code)
  values (v_group, 'Sim Group', v_owner, 'sim-' || substr(v_group::text, 1, 8));

  insert into pools (id, group_id, name, status, created_by)
  values (v_pool, v_group, 'Sim Pool', 'open', v_owner);

  for v_i in 1..7 loop
    v_user := 'sim_user_' || v_i;
    insert into group_members (group_id, user_id, role)
      values (v_group, v_user, case when v_i = 1 then 'owner' else 'member' end);
    insert into pool_members (pool_id, user_id) values (v_pool, v_user);
  end loop;

  -- Lock as the owner.
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);
  perform lock_pool(v_pool);

  -- Allotments must sum to 48.
  select sum(teams_allotted) into v_total from pool_members where pool_id = v_pool;
  if v_total <> 48 then
    raise exception 'Allotments sum to %, expected 48', v_total;
  end if;

  -- Each member spins until their allotment is exhausted.
  for v_i in 1..7 loop
    v_user := 'sim_user_' || v_i;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

    select teams_allotted into v_allot from pool_members
      where pool_id = v_pool and user_id = v_user;

    for v_used in 1..v_allot loop
      perform assign_random_team(v_pool);
    end loop;

    -- This member's picks must equal their allotment.
    select count(*) into v_used from picks where pool_id = v_pool and user_id = v_user;
    if v_used <> v_allot then
      raise exception 'User % has % picks, expected %', v_user, v_used, v_allot;
    end if;
  end loop;

  -- All 48 teams assigned, zero duplicates.
  select count(*) into v_total from picks where pool_id = v_pool;
  if v_total <> 48 then
    raise exception 'Total picks = %, expected 48', v_total;
  end if;

  select count(*) into v_dupes from (
    select team_id from picks where pool_id = v_pool
    group by team_id having count(*) > 1
  ) d;
  if v_dupes <> 0 then
    raise exception 'Found % duplicated teams', v_dupes;
  end if;

  -- Pool should have auto-completed.
  if (select status from pools where id = v_pool) <> 'complete' then
    raise exception 'Pool status should be complete after 48 picks';
  end if;

  raise notice 'PASS: 7 members drafted all 48 teams, no duplicates, counts match allotments.';
end $$;

rollback;
