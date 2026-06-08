-- Seed the 48 final 2026 FIFA World Cup teams. Source of truth — do not alter.
-- Idempotent: only inserts when the teams table is empty.

insert into teams (name, code, wc_group)
select * from (values
  ('Mexico','mx','A'),
  ('South Africa','za','A'),
  ('South Korea','kr','A'),
  ('Czechia','cz','A'),
  ('Canada','ca','B'),
  ('Bosnia and Herzegovina','ba','B'),
  ('Qatar','qa','B'),
  ('Switzerland','ch','B'),
  ('Brazil','br','C'),
  ('Morocco','ma','C'),
  ('Haiti','ht','C'),
  ('Scotland','gb-sct','C'),
  ('United States','us','D'),
  ('Paraguay','py','D'),
  ('Australia','au','D'),
  ('Türkiye','tr','D'),
  ('Germany','de','E'),
  ('Curaçao','cw','E'),
  ('Côte d''Ivoire','ci','E'),
  ('Ecuador','ec','E'),
  ('Netherlands','nl','F'),
  ('Japan','jp','F'),
  ('Sweden','se','F'),
  ('Tunisia','tn','F'),
  ('Belgium','be','G'),
  ('Egypt','eg','G'),
  ('Iran','ir','G'),
  ('New Zealand','nz','G'),
  ('Spain','es','H'),
  ('Cape Verde','cv','H'),
  ('Saudi Arabia','sa','H'),
  ('Uruguay','uy','H'),
  ('France','fr','I'),
  ('Senegal','sn','I'),
  ('Iraq','iq','I'),
  ('Norway','no','I'),
  ('Argentina','ar','J'),
  ('Algeria','dz','J'),
  ('Austria','at','J'),
  ('Jordan','jo','J'),
  ('Portugal','pt','K'),
  ('DR Congo','cd','K'),
  ('Uzbekistan','uz','K'),
  ('Colombia','co','K'),
  ('England','gb-eng','L'),
  ('Croatia','hr','L'),
  ('Ghana','gh','L'),
  ('Panama','pa','L')
) as t(name, code, wc_group)
where not exists (select 1 from teams limit 1);

-- Assert exactly 48 teams across groups A..L
do $$
declare
  v_count int;
  v_groups int;
begin
  select count(*) into v_count from teams;
  if v_count <> 48 then
    raise exception 'Expected 48 teams, found %', v_count;
  end if;
  select count(distinct wc_group) into v_groups from teams;
  if v_groups <> 12 then
    raise exception 'Expected 12 groups (A..L), found %', v_groups;
  end if;
  raise notice 'Seed OK: 48 teams across 12 groups';
end $$;
