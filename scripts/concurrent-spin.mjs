// Concurrency proof for assign_random_team().
//
// Spins two members of a locked pool in parallel and asserts that the
// unique (pool_id, team_id) constraint + retry loop never produce a duplicate
// team and that exactly 48 teams get assigned.
//
// Requires a direct Postgres connection (NOT the service-role REST key):
//   DATABASE_URL='postgresql://postgres:[password]@db.<ref>.supabase.co:5432/postgres' \
//     node scripts/concurrent-spin.mjs
//
// Find the connection string in Supabase dashboard → Project Settings → Database.
// The script creates a temporary group/pool, runs the test, then cleans up.

import pg from "pg";

const { Client } = pg;
const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string.");
  process.exit(1);
}

const USER_A = "concurrency_user_a";
const USER_B = "concurrency_user_b";

function impersonate(client, sub) {
  // Mirror how Supabase exposes the JWT claims so current_clerk_id() resolves.
  return client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub }),
  ]);
}

async function main() {
  const admin = new Client({ connectionString: URL });
  const a = new Client({ connectionString: URL });
  const b = new Client({ connectionString: URL });
  await Promise.all([admin.connect(), a.connect(), b.connect()]);

  let poolId;
  try {
    const pool = await admin.query(
      `insert into pools (name, owner_id, invite_code, status)
       values ('Concurrency Pool', $1, 'conc-' || substr(gen_random_uuid()::text,1,8), 'open')
       returning id`,
      [USER_A],
    );
    poolId = pool.rows[0].id;

    for (const u of [USER_A, USER_B]) {
      await admin.query(
        `insert into pool_members (pool_id, user_id) values ($1, $2)`,
        [poolId, u],
      );
    }

    // Lock as the owner → 2 members, 24 teams each.
    await impersonate(admin, USER_A);
    await admin.query("select lock_pool($1)", [poolId]);

    await impersonate(a, USER_A);
    await impersonate(b, USER_B);

    // Fire all 48 spins as fast as possible, interleaved across both members.
    const spins = [];
    for (let i = 0; i < 24; i++) {
      spins.push(a.query("select id from assign_random_team($1)", [poolId]));
      spins.push(b.query("select id from assign_random_team($1)", [poolId]));
    }
    await Promise.all(spins);

    const check = await admin.query(
      `select count(*)::int as total,
              count(distinct team_id)::int as distinct_teams
       from picks where pool_id = $1`,
      [poolId],
    );
    const { total, distinct_teams } = check.rows[0];

    if (total !== 48) throw new Error(`Expected 48 picks, got ${total}`);
    if (distinct_teams !== 48)
      throw new Error(`Duplicate teams! ${distinct_teams} distinct of ${total}`);

    console.log(
      `PASS: 48 concurrent picks, ${distinct_teams} distinct teams, zero duplicates.`,
    );
  } finally {
    if (poolId) {
      await admin.query("delete from pools where id = $1", [poolId]);
    }
    await Promise.all([admin.end(), a.end(), b.end()]);
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
