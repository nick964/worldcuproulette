-- Pool notes: free-text set by the creator (e.g. "Entry fee: $20, winner
-- takes all"). Shown to members on the pool page and to invitees on the
-- join preview.

alter table pools add column if not exists notes text;

-- pool_preview's return type changes (adds notes), so drop + recreate.
drop function if exists pool_preview(text);

create function pool_preview(p_code text)
returns table (id uuid, name text, status text, member_count bigint, notes text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.status, count(pm.user_id), p.notes
  from pools p
  left join pool_members pm on pm.pool_id = p.id
  where p.invite_code = p_code
  group by p.id, p.name, p.status, p.notes;
$$;

grant execute on function pool_preview(text) to authenticated;
