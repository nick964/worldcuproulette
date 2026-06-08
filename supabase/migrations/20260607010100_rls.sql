-- Row Level Security: helper functions + policies.
-- Helpers are SECURITY DEFINER so they bypass RLS internally and avoid
-- infinite recursion when a table's policy needs to read that same table.

-- Current Clerk user id from the verified JWT, or null when unauthenticated.
create or replace function current_clerk_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = current_clerk_id()
  );
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

-- Group that a pool belongs to (helper for pool_members/picks policies).
create or replace function pool_group_id(p_pool_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from pools where id = p_pool_id;
$$;

-- Enable RLS everywhere
alter table teams         enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table pools         enable row level security;
alter table pool_members  enable row level security;
alter table picks         enable row level security;

-- teams: world-readable reference data
drop policy if exists teams_read on teams;
create policy teams_read on teams for select using (true);

-- groups: members (incl. owner) can read; anyone signed-in can create; owner manages
drop policy if exists groups_read on groups;
create policy groups_read on groups for select
  using (owner_id = current_clerk_id() or is_group_member(id));

drop policy if exists groups_insert on groups;
create policy groups_insert on groups for insert
  with check (owner_id = current_clerk_id());

drop policy if exists groups_update on groups;
create policy groups_update on groups for update
  using (owner_id = current_clerk_id())
  with check (owner_id = current_clerk_id());

drop policy if exists groups_delete on groups;
create policy groups_delete on groups for delete
  using (owner_id = current_clerk_id());

-- group_members: members can see co-members; you may add/remove only yourself
drop policy if exists group_members_read on group_members;
create policy group_members_read on group_members for select
  using (is_group_member(group_id));

drop policy if exists group_members_insert on group_members;
create policy group_members_insert on group_members for insert
  with check (user_id = current_clerk_id());

drop policy if exists group_members_delete on group_members;
create policy group_members_delete on group_members for delete
  using (user_id = current_clerk_id());

-- pools: visible to group members; created by a group member
drop policy if exists pools_read on pools;
create policy pools_read on pools for select
  using (is_group_member(group_id));

drop policy if exists pools_insert on pools;
create policy pools_insert on pools for insert
  with check (created_by = current_clerk_id() and is_group_member(group_id));

drop policy if exists pools_update on pools;
create policy pools_update on pools for update
  using (created_by = current_clerk_id())
  with check (created_by = current_clerk_id());

-- pool_members: pool members see each other; you may join/leave only yourself
drop policy if exists pool_members_read on pool_members;
create policy pool_members_read on pool_members for select
  using (is_pool_member(pool_id) or is_group_member(pool_group_id(pool_id)));

drop policy if exists pool_members_insert on pool_members;
create policy pool_members_insert on pool_members for insert
  with check (user_id = current_clerk_id() and is_group_member(pool_group_id(pool_id)));

drop policy if exists pool_members_delete on pool_members;
create policy pool_members_delete on pool_members for delete
  using (user_id = current_clerk_id());

-- picks: pool members can read all picks in their pool.
-- Inserts happen through the SECURITY DEFINER assign_random_team() RPC, which
-- bypasses RLS; this policy is a safety net for any direct insert attempt.
drop policy if exists picks_read on picks;
create policy picks_read on picks for select
  using (is_pool_member(pool_id));

drop policy if exists picks_insert on picks;
create policy picks_insert on picks for insert
  with check (user_id = current_clerk_id() and is_pool_member(pool_id));
