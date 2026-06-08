-- DEV RESET — drops all app objects (including the old groups-based schema) so
-- the migrations can be re-applied cleanly. DESTRUCTIVE: deletes all pool data.
-- Run this once, then re-run the migrations in order, then seed.sql.

drop function if exists assign_random_team(uuid)   cascade;
drop function if exists lock_pool(uuid)            cascade;
drop function if exists set_winning_team(uuid, uuid) cascade;
drop function if exists join_group(text)           cascade;
drop function if exists join_pool(text)            cascade;
drop function if exists group_preview(text)        cascade;
drop function if exists pool_preview(text)         cascade;
drop function if exists is_group_member(uuid)      cascade;
drop function if exists is_pool_member(uuid)       cascade;
drop function if exists pool_group_id(uuid)        cascade;
drop function if exists current_clerk_id()         cascade;

drop table if exists picks         cascade;
drop table if exists pool_members  cascade;
drop table if exists pools         cascade;
drop table if exists group_members cascade;  -- old schema
drop table if exists groups        cascade;  -- old schema
drop table if exists teams         cascade;
