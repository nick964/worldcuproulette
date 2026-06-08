-- "Spin the World Cup" — schema.
-- A POOL is the social container: it has an invite link, members, one draft,
-- and (after the final) a winning team. There is no separate "group" concept.
-- All user_id columns hold the Clerk user id (text), matched against auth.jwt()->>'sub'.

-- The 48 World Cup teams (reference data, seeded separately)
create table if not exists teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text not null,            -- flagcdn code (e.g. 'br', 'gb-eng')
  confederation text,
  wc_group      char(1) not null,         -- World Cup group letter A..L
  created_at    timestamptz default now()
);

-- A pool: invite link + a single draft instance.
create table if not exists pools (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  owner_id        text not null,                -- clerk user id of the creator
  invite_code     text not null unique,         -- short slug for the join link
  status          text not null default 'open'
    check (status in ('open','locked','complete')),
  winning_team_id uuid references teams(id),    -- set by owner after the final
  created_at      timestamptz default now()
);

create table if not exists pool_members (
  pool_id        uuid references pools(id) on delete cascade,
  user_id        text not null,
  role           text not null default 'member',  -- 'owner' | 'member'
  teams_allotted int not null default 0,          -- computed at lock time
  joined_at      timestamptz default now(),
  primary key (pool_id, user_id)
);

-- One row per team assigned to a user in a pool
create table if not exists picks (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid references pools(id) on delete cascade,
  user_id    text not null,
  team_id    uuid references teams(id),
  created_at timestamptz default now(),
  unique (pool_id, team_id)                        -- no team twice per pool
);

create index if not exists picks_pool_user_idx on picks (pool_id, user_id);
create index if not exists pool_members_user_idx on pool_members (user_id);
