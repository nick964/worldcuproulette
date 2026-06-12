-- Soft player target: "4 of 10 spots taken" messaging. Display-only — the
-- owner can lock earlier or let the pool grow past it; the only hard cap
-- remains 48 (enforced by join_pool/lock_pool).

alter table pools add column if not exists target_size int
  check (target_size between 1 and 48);

-- pool_preview's return type changes again (adds target_size): drop+recreate,
-- and re-apply BOTH grants (authenticated + anon — see 20260611030000).
drop function if exists pool_preview(text);

create function pool_preview(p_code text)
returns table (
  id uuid,
  name text,
  status text,
  member_count bigint,
  notes text,
  target_size int
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.status, count(pm.user_id), p.notes, p.target_size
  from pools p
  left join pool_members pm on pm.pool_id = p.id
  where p.invite_code = p_code
  group by p.id, p.name, p.status, p.notes, p.target_size;
$$;

grant execute on function pool_preview(text) to authenticated, anon;
