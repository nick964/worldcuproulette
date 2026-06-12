-- Invite links are public: a signed-out visitor opening /join/[code] must be
-- able to preview the pool (name, member count, notes) before they create an
-- account. join_pool stays authenticated-only.
-- NOTE: pool_preview is dropped/recreated by 20260611010000_pool_notes.sql;
-- if it's ever recreated again, re-apply this grant.

grant execute on function pool_preview(text) to anon;
