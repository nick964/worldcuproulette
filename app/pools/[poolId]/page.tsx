/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getUserMap, displayName } from "@/lib/clerk";
import { joinPool, leavePool, lockPool } from "@/lib/actions";
import { flagUrl } from "@/lib/flags";

type Team = { id: string; name: string; code: string; wc_group: string };

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  locked: "Drafting",
  complete: "Complete",
};

export default async function PoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const userId = await auth().then((a) => a.userId);
  const supabase = createClient();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name, status, group_id, created_by, winning_team_id")
    .eq("id", poolId)
    .maybeSingle();
  if (!pool) notFound();

  const [{ data: poolMembers }, { data: picks }, { data: teams }] =
    await Promise.all([
      supabase
        .from("pool_members")
        .select("user_id, teams_allotted")
        .eq("pool_id", poolId)
        .order("joined_at", { ascending: true }),
      supabase.from("picks").select("user_id, team_id").eq("pool_id", poolId),
      supabase.from("teams").select("id, name, code, wc_group"),
    ]);

  const members = poolMembers ?? [];
  const teamList = (teams ?? []) as Team[];
  const teamById = new Map(teamList.map((t) => [t.id, t]));

  const picksByUser = new Map<string, Team[]>();
  const claimed = new Set<string>();
  for (const p of picks ?? []) {
    claimed.add(p.team_id);
    const t = teamById.get(p.team_id);
    if (!t) continue;
    const arr = picksByUser.get(p.user_id) ?? [];
    arr.push(t);
    picksByUser.set(p.user_id, arr);
  }
  const remainingCount = teamList.length - claimed.size;

  const userMap = await getUserMap(members.map((m) => m.user_id));
  const isOwner = pool.created_by === userId;
  const myMembership = members.find((m) => m.user_id === userId);
  const isMember = Boolean(myMembership);
  const myUsed = userId ? (picksByUser.get(userId)?.length ?? 0) : 0;
  const mySpinsLeft = (myMembership?.teams_allotted ?? 0) - myUsed;

  const M = members.length;
  const base = M > 0 ? Math.floor(48 / M) : 0;
  const rem = M > 0 ? 48 % M : 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/groups/${pool.group_id}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← Back to group
      </Link>

      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{pool.name}</h1>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {STATUS_LABEL[pool.status] ?? pool.status}
        </span>
      </div>

      {/* OPEN: manage membership, then lock */}
      {pool.status === "open" && (
        <section className="mt-6 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">Members ({M})</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800"
                >
                  {displayName(userMap, m.user_id)}
                  {m.user_id === pool.created_by && (
                    <span className="ml-1 text-xs text-zinc-400">(owner)</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex gap-2">
              {!isMember && M < 48 && (
                <form action={joinPool}>
                  <input type="hidden" name="poolId" value={pool.id} />
                  <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
                    Join pool
                  </button>
                </form>
              )}
              {!isMember && M >= 48 && (
                <p className="text-sm text-amber-600">
                  This pool is full (48 members max).
                </p>
              )}
              {isMember && !isOwner && (
                <form action={leavePool}>
                  <input type="hidden" name="poolId" value={pool.id} />
                  <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">
                    Leave pool
                  </button>
                </form>
              )}
            </div>
          </div>

          {isOwner && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-semibold">Lock &amp; start drafting</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Locking freezes membership and distributes all 48 teams. With{" "}
                {M} member{M === 1 ? "" : "s"}:{" "}
                {rem === 0 ? (
                  <>everyone gets <strong>{base}</strong> teams.</>
                ) : (
                  <>
                    <strong>{rem}</strong> member{rem === 1 ? "" : "s"} get{" "}
                    <strong>{base + 1}</strong>, the rest get{" "}
                    <strong>{base}</strong>.
                  </>
                )}
              </p>
              <form action={lockPool} className="mt-3">
                <input type="hidden" name="poolId" value={pool.id} />
                <button
                  disabled={M < 1}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Lock pool
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {/* LOCKED: draft area (wheel added next milestone) + standings */}
      {pool.status === "locked" && (
        <section className="mt-6 space-y-6">
          {isMember ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-semibold">Your draft</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Spins remaining: <strong>{Math.max(mySpinsLeft, 0)}</strong>
              </p>
              {/* Wheel component is wired in the next milestone */}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              This pool is locked; you are not a participant.
            </p>
          )}

          <Standings
            members={members}
            picksByUser={picksByUser}
            userMap={userMap}
            ownerId={pool.created_by}
            remainingCount={remainingCount}
          />
        </section>
      )}

      {/* COMPLETE: winner + final standings */}
      {pool.status === "complete" && (
        <section className="mt-6 space-y-6">
          {pool.winning_team_id ? (
            <WinnerBanner
              team={teamById.get(pool.winning_team_id)}
              holder={findHolder(picksByUser, pool.winning_team_id)}
              userMap={userMap}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Draft complete. The owner can set the winning team once the World
              Cup final is decided.
            </p>
          )}

          <Standings
            members={members}
            picksByUser={picksByUser}
            userMap={userMap}
            ownerId={pool.created_by}
            remainingCount={remainingCount}
          />
        </section>
      )}
    </div>
  );
}

function findHolder(
  picksByUser: Map<string, Team[]>,
  teamId: string,
): string | undefined {
  for (const [user, teams] of picksByUser) {
    if (teams.some((t) => t.id === teamId)) return user;
  }
  return undefined;
}

function WinnerBanner({
  team,
  holder,
  userMap,
}: {
  team: Team | undefined;
  holder: string | undefined;
  userMap: Map<string, { name: string }>;
}) {
  if (!team) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        🏆 World Cup winner
      </p>
      <img
        src={flagUrl(team.code, "w160")}
        alt={team.name}
        className="mx-auto mt-3 h-16 w-auto rounded shadow"
      />
      <p className="mt-2 text-xl font-bold">{team.name}</p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        Held by{" "}
        <strong>{holder ? (userMap.get(holder)?.name ?? "Member") : "nobody"}</strong>{" "}
        — they win the pool!
      </p>
    </div>
  );
}

function Standings({
  members,
  picksByUser,
  userMap,
  ownerId,
  remainingCount,
}: {
  members: { user_id: string; teams_allotted: number }[];
  picksByUser: Map<string, Team[]>;
  userMap: Map<string, { name: string }>;
  ownerId: string;
  remainingCount: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Standings</h2>
        <span className="text-sm text-zinc-500">
          {remainingCount} team{remainingCount === 1 ? "" : "s"} unclaimed
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {members.map((m) => {
          const teams = picksByUser.get(m.user_id) ?? [];
          return (
            <li key={m.user_id} className="border-t border-zinc-100 pt-3 dark:border-zinc-800 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {userMap.get(m.user_id)?.name ?? "Member"}
                  {m.user_id === ownerId && (
                    <span className="ml-1 text-xs text-zinc-400">(owner)</span>
                  )}
                </span>
                <span className="text-xs text-zinc-500">
                  {teams.length}/{m.teams_allotted} drafted
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {teams.length === 0 && (
                  <span className="text-xs text-zinc-400">No teams yet</span>
                )}
                {teams.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-800"
                    title={`Group ${t.wc_group}`}
                  >
                    <img
                      src={flagUrl(t.code, "w80")}
                      alt={t.name}
                      className="h-3.5 w-auto rounded-sm"
                    />
                    {t.name}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
