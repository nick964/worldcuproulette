# Spin the World Cup — Build Notes

App for the 2026 FIFA World Cup (48 teams): create a **Pool**, share its invite
link, friends join. When the owner locks the pool, members spin a slot-machine
wheel of unclaimed flags; the assigned team is chosen **server-side and
atomically**. Whoever holds the World Cup winner wins the pool.

> **Model note:** A **pool is the single social container** — it owns the invite
> link, the members, the draft, and the winner. There is no separate "group"
> concept (an earlier version had groups containing many pools; that was removed
> as confusing — one pool = one invite = one draft).

## Stack
- Next.js 16.2.7 (App Router) — **NOTE: this Next renamed `middleware.ts` → `proxy.ts`** and `params` is async (`await params`). Server mutations use `'use server'` Server Actions.
- Supabase (Postgres) for data, with **native Clerk Third-Party Auth** (NOT the deprecated JWT template). RLS keys off `auth.jwt()->>'sub'`.
- Clerk for auth. Tailwind v4 for styling.

---

## ⚠️ Manual steps you must do (the app won't work until these are done)

1. **Apply the database.** In the Supabase dashboard → SQL Editor, run, in order:
   0. `supabase/reset_dev.sql` — **only if you applied the old groups-based schema
      before** (drops all app objects; DESTRUCTIVE — wipes pool data). Skip on a
      fresh project.
   1. `supabase/migrations/20260607010000_schema.sql`
   2. `supabase/migrations/20260607010100_rls.sql`
   3. `supabase/migrations/20260607010200_functions.sql`
   4. `supabase/migrations/20260607010300_join.sql`
   5. `supabase/seed.sql`  (asserts exactly 48 teams)
   (Or `supabase db push` + `supabase db seed` if you wire up the CLI.)
2. **Clerk ↔ Supabase native integration** — already configured during setup:
   - Clerk dashboard: Supabase integration enabled.
   - Supabase dashboard: Clerk added as a Third-Party Auth provider
     (domain `leading-skylark-95.clerk.accounts.dev`).
3. **Verify the DB logic (optional but recommended):** run
   `supabase/tests/draft_simulation.sql` in the SQL Editor — it should print
   `PASS: 7 members drafted all 48 teams...` and roll back.

## Environment variables (all already in `.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **only needed to run the optional Node concurrency
  script** (`scripts/`), never shipped to the client. Add it if you want to run that script.

---

## Decisions / assumptions made (defaults from the spec + ambiguities resolved)
- **Pool "owner" = `pools.owner_id`.** The creator; they lock the pool and set
  the winning team.
- **Joining is invite-only:** you join a pool via its invite link (`/join/[code]`),
  which adds you as a member. You can only join while the pool is `open`; once
  locked, membership is frozen. There is no public list of pools to browse.
- **No `profiles` table.** Display names/avatars are fetched from Clerk on the
  server via `clerkClient` when rendering member lists. Avoids webhook infra.
- **Allotment at lock:** `base = floor(48/M)`, and `48 mod M` randomly chosen
  members get one extra team. Shown transparently in the UI.
- **Membership cap:** joining/locking a pool with >48 members is blocked.
- **M = 1** is allowed (that member drafts all 48).
- **Async draft:** after lock, members spin their allotment anytime; no live turn
  order. Integrity comes from the atomic RPC + `unique (pool_id, team_id)`.
- **Server-authoritative spin:** the STOP button is cosmetic. `assign_random_team`
  picks the team server-side and the wheel animates to it.
- Removed the throwaway `favorite_teams` table + `/favorites` page from the
  earlier Supabase smoke-test; not part of the product.

## RLS design note
The helper function `is_pool_member` is `SECURITY DEFINER` so policies can
reference the same table they protect (`pool_members`) without infinite
recursion. Invite preview/join go through `SECURITY DEFINER` functions
(`pool_preview`, `join_pool`) because a not-yet-member can't see the pool via RLS.

---

## Build progress — all milestones complete
- [x] Milestone 1 — DB: schema, RLS + helpers, RPCs (`lock_pool`,
      `assign_random_team`, `set_winning_team`), seed (48 teams), simulation test.
- [x] Milestone 2 — auth wiring + app shell (home dashboard).
- [x] Milestone 3 — invite link + copy / join-by-link page.
- [x] Milestone 4 — pools: create / join / leave / owner lock + allotment preview.
- [x] **Refactor** — collapsed groups+pools into a single **pool** container
      (pool now holds the invite link & members directly). Removed `groups` /
      `group_members` tables, `/groups` route, and group server actions.
- [x] Milestone 5 — slot-machine wheel; server-authoritative spin.
- [x] Milestone 6 — pool dashboard (standings) + owner winner control + winner banner.
- [x] Milestone 7 — verify + polish (error/not-found/loading, lint, build).

## Verification done in this build
- `next build` — passes (all routes server-rendered on demand).
- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.

## Verification that needs a live DB (you must run — I have no DB credentials here)
- **Draft simulation:** `supabase/tests/draft_simulation.sql` in the SQL Editor.
  Asserts a 7-member pool drafts all 48 teams, no duplicates, counts = allotments.
- **Concurrency proof:** `node scripts/concurrent-spin.mjs` with `DATABASE_URL`
  set to your Supabase Postgres connection string (Project Settings → Database).
  Fires 48 spins across two members in parallel; asserts zero duplicate teams.
  (`pg` was added as a devDependency for this script only.)

## Routes
- `/` — home: your pools + create-pool / join-by-code forms (or sign-in when logged out).
- `/join/[code]` — pool preview + join button (blocked once the pool has started).
- `/pools/[poolId]` — open (invite link + members + owner lock), locked (wheel +
  standings), complete (winner banner + owner winner control + standings).

## Wheel implementation notes
- The STOP button calls `spinForTeam` (→ `assign_random_team` RPC) which picks the
  team server-side; the reel then eases onto that team. `spinForTeam` deliberately
  does NOT `revalidatePath` (that would auto-refresh and wipe the reveal) — the
  wheel calls `router.refresh()` itself when the user clicks "Next spin"/"Finish",
  and the parent remounts it via a `key` so state resets cleanly.
- Edge case: if a concurrent pick removed the server-returned team from the local
  unclaimed list (rare), the reel lands on index 0 but the reveal still shows the
  correct server team. The pick itself is always correct.

## Things you might want to do next (not required by the spec)
- Supabase Realtime on `picks` for live standings updates (left as a nice-to-have).
- A `profiles` table + Clerk webhook if Clerk API calls per render become a concern.
- Live sports-API integration to auto-set the winning team (explicit stretch goal).
