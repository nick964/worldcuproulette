# Spin the World Cup — Build Notes

App for the 2026 FIFA World Cup (48 teams): create a **Group**, share an invite
link, run **Pools** (drafts) inside it. When a pool locks, members spin a
slot-machine wheel of unclaimed flags; the assigned team is chosen
**server-side and atomically**. Whoever holds the World Cup winner wins the pool.

## Stack
- Next.js 16.2.7 (App Router) — **NOTE: this Next renamed `middleware.ts` → `proxy.ts`** and `params` is async (`await params`). Server mutations use `'use server'` Server Actions.
- Supabase (Postgres) for data, with **native Clerk Third-Party Auth** (NOT the deprecated JWT template). RLS keys off `auth.jwt()->>'sub'`.
- Clerk for auth. Tailwind v4 for styling.

---

## ⚠️ Manual steps you must do (the app won't work until these are done)

1. **Apply the database.** In the Supabase dashboard → SQL Editor, run, in order:
   1. `supabase/migrations/20260607010000_schema.sql`
   2. `supabase/migrations/20260607010100_rls.sql`
   3. `supabase/migrations/20260607010200_functions.sql`
   4. `supabase/seed.sql`  (asserts exactly 48 teams)
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
- **Pool "owner" = `pools.created_by`.** That user locks the pool and sets the
  winning team. (Spec said "group/pool owner"; using the pool creator is the
  least surprising and avoids ambiguity when a group has many pools.)
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
Helper functions `is_group_member`, `is_pool_member`, `pool_group_id` are
`SECURITY DEFINER` so policies can reference the same table they protect without
infinite recursion.

---

## Build progress — all milestones complete
- [x] Milestone 1 — DB: schema, RLS + helpers, RPCs (`lock_pool`,
      `assign_random_team`, `set_winning_team`), seed (48 teams), simulation test.
- [x] Milestone 2 — auth wiring + app shell (home dashboard).
- [x] Milestone 3 — groups: create / list / invite link + copy / join-by-link.
- [x] Milestone 4 — pools: create / join / leave / owner lock + allotment preview.
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
- `/` — home: your groups + create/join forms (or sign-in when logged out).
- `/groups/[groupId]` — invite link, members, pools, create pool.
- `/join/[code]` — invite preview + join button.
- `/pools/[poolId]` — open (membership + lock), locked (wheel + standings),
  complete (winner banner + owner winner control + standings).

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
