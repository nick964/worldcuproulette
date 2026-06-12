-- Allow pool owners to delete their pools. Memberships and picks go with it
-- via the existing "on delete cascade" foreign keys.

drop policy if exists pools_delete on pools;
create policy pools_delete on pools for delete
  using (owner_id = current_clerk_id());
