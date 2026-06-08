-- Row Level Security. is_pool_member is SECURITY DEFINER so it bypasses RLS
-- internally and avoids recursion when pool_members' own policy reads it.

create or replace function current_clerk_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from pool_members pm
    where pm.pool_id = p_pool_id
      and pm.user_id = current_clerk_id()
  );
$$;

alter table teams        enable row level security;
alter table pools        enable row level security;
alter table pool_members enable row level security;
alter table picks        enable row level security;

-- teams: world-readable reference data
drop policy if exists teams_read on teams;
create policy teams_read on teams for select using (true);

-- pools: members (and the owner, even before their membership row exists) can
-- read; anyone signed-in can create; only the owner can update.
drop policy if exists pools_read on pools;
create policy pools_read on pools for select
  using (owner_id = current_clerk_id() or is_pool_member(id));

drop policy if exists pools_insert on pools;
create policy pools_insert on pools for insert
  with check (owner_id = current_clerk_id());

drop policy if exists pools_update on pools;
create policy pools_update on pools for update
  using (owner_id = current_clerk_id())
  with check (owner_id = current_clerk_id());

-- pool_members: members see each other; you may add/remove only yourself.
drop policy if exists pool_members_read on pool_members;
create policy pool_members_read on pool_members for select
  using (is_pool_member(pool_id));

drop policy if exists pool_members_insert on pool_members;
create policy pool_members_insert on pool_members for insert
  with check (user_id = current_clerk_id());

drop policy if exists pool_members_delete on pool_members;
create policy pool_members_delete on pool_members for delete
  using (user_id = current_clerk_id());

-- picks: pool members can read all picks in their pool. Inserts happen through
-- the SECURITY DEFINER assign_random_team() RPC; this is a safety net.
drop policy if exists picks_read on picks;
create policy picks_read on picks for select
  using (is_pool_member(pool_id));

drop policy if exists picks_insert on picks;
create policy picks_insert on picks for insert
  with check (user_id = current_clerk_id() and is_pool_member(pool_id));
