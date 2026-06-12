/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getUserMap, displayName, type DisplayUser } from "@/lib/clerk";
import { leavePool, lockPool, setWinningTeam } from "@/lib/actions";
import { flagUrl } from "@/lib/flags";
import {
  getScoreboard,
  teamScore,
  type Scoreboard,
} from "@/lib/scores";
import { Wheel } from "@/components/wheel";
import { InviteLink } from "@/components/invite-link";
import { DeletePoolButton } from "@/components/delete-pool";
import { StatusChip } from "@/components/status-chip";
import { SubmitButton } from "@/components/submit-button";

type Team = { id: string; name: string; code: string; wc_group: string };
type Member = { user_id: string; role: string; teams_allotted: number };

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
    .select("id, name, status, owner_id, invite_code, winning_team_id, notes")
    .eq("id", poolId)
    .maybeSingle();
  if (!pool) notFound();

  const [{ data: poolMembers }, { data: picks }, { data: teams }] =
    await Promise.all([
      supabase
        .from("pool_members")
        .select("user_id, role, teams_allotted")
        .eq("pool_id", poolId)
        .order("joined_at", { ascending: true }),
      supabase.from("picks").select("user_id, team_id").eq("pool_id", poolId),
      supabase.from("teams").select("id, name, code, wc_group"),
    ]);

  const members = (poolMembers ?? []) as Member[];
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
  const unclaimedTeams = teamList.filter((t) => !claimed.has(t.id));

  const [userMap, scoreboard] = await Promise.all([
    getUserMap(members.map((m) => m.user_id)),
    // Live results only matter once teams have been drafted.
    pool.status === "open"
      ? Promise.resolve(null)
      : getScoreboard(),
  ]);
  const isOwner = pool.owner_id === userId;
  const myMembership = members.find((m) => m.user_id === userId);
  const isMember = Boolean(myMembership);
  const myUsed = userId ? (picksByUser.get(userId)?.length ?? 0) : 0;
  const mySpinsLeft = (myMembership?.teams_allotted ?? 0) - myUsed;

  const M = members.length;
  const base = M > 0 ? Math.floor(48 / M) : 0;
  const rem = M > 0 ? 48 % M : 0;
  const winnerHolder = pool.winning_team_id
    ? findHolder(picksByUser, pool.winning_team_id)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <Link
        href="/pools"
        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
      >
        ← All pools
      </Link>

      {/* Header */}
      <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold uppercase tracking-tight md:text-4xl">
              {pool.name}
            </h1>
            <StatusChip status={pool.status} />
          </div>
          <div className="mt-2 flex items-center gap-4">
            <AvatarStack members={members} userMap={userMap} />
            <span className="text-xs uppercase tracking-widest text-on-surface-variant">
              Tournament: World Cup 2026 · {M} player{M === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {pool.status === "open" && (
          <div className="w-full md:w-96">
            <InviteLink code={pool.invite_code} />
          </div>
        )}
      </div>

      {pool.notes && (
        <div className="glass-card mt-5 flex items-start gap-3 rounded-xl border-secondary-fixed/20 p-4">
          <span aria-hidden>📌</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
              Pool notes
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-on-surface">
              {pool.notes}
            </p>
          </div>
        </div>
      )}

      {/* OPEN: invite, manage membership, then lock */}
      {pool.status === "open" && (
        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="glass-card rounded-xl p-6 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold uppercase italic">
              Roster ({M})
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Share the invite link above — membership freezes when the pool is
              locked.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {members.map((m) => {
                const u = userMap.get(m.user_id);
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container px-3 py-1.5 text-sm"
                  >
                    <Avatar user={u} size="sm" />
                    {displayName(userMap, m.user_id)}
                    {m.user_id === pool.owner_id && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-secondary-fixed">
                        Owner
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {isMember && !isOwner && (
              <form action={leavePool} className="mt-5">
                <input type="hidden" name="poolId" value={pool.id} />
                <SubmitButton
                  pendingLabel="Leaving…"
                  className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-error/50 hover:text-error disabled:opacity-50"
                >
                  Leave pool
                </SubmitButton>
              </form>
            )}
          </div>

          {isOwner && (
            <div className="glass-card rounded-xl border-secondary-fixed/20 p-6">
              <h2 className="font-display text-lg font-semibold uppercase italic text-secondary-fixed">
                Lock &amp; start drafting
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Locking freezes the roster and deals out all 48 nations. With{" "}
                {M} player{M === 1 ? "" : "s"}:{" "}
                {rem === 0 ? (
                  <>
                    everyone gets{" "}
                    <strong className="text-on-surface">{base}</strong> teams.
                  </>
                ) : (
                  <>
                    <strong className="text-on-surface">{rem}</strong> player
                    {rem === 1 ? "" : "s"} get{" "}
                    <strong className="text-on-surface">{base + 1}</strong>,
                    the rest get{" "}
                    <strong className="text-on-surface">{base}</strong>.
                  </>
                )}
              </p>
              <form action={lockPool} className="mt-4">
                <input type="hidden" name="poolId" value={pool.id} />
                <SubmitButton
                  pendingLabel="Locking…"
                  className="gold-glow w-full rounded-lg bg-secondary-container py-3 font-display font-bold uppercase tracking-widest text-on-secondary-container transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  🔒 Lock pool
                </SubmitButton>
              </form>
            </div>
          )}
        </section>
      )}

      {/* LOCKED: the wheel + standings */}
      {pool.status === "locked" && (
        <section className="mt-8 space-y-8">
          {isMember ? (
            <div>
              <div className="text-center">
                <h2 className="font-display text-2xl font-semibold uppercase italic">
                  Your draft
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Spins remaining:{" "}
                  <strong className="font-display text-lg text-secondary-fixed">
                    {Math.max(mySpinsLeft, 0)}
                  </strong>
                </p>
              </div>
              <div className="mt-4">
                <Wheel
                  key={`${unclaimedTeams.length}-${Math.max(mySpinsLeft, 0)}`}
                  poolId={pool.id}
                  teams={unclaimedTeams}
                  spinsLeft={Math.max(mySpinsLeft, 0)}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              This pool is locked; you are not a participant.
            </p>
          )}

          <PoolBody
            members={members}
            picksByUser={picksByUser}
            userMap={userMap}
            ownerId={pool.owner_id}
            remainingCount={remainingCount}
            winnerHolder={winnerHolder}
            winningTeamId={pool.winning_team_id}
            status={pool.status}
            scoreboard={scoreboard}
          />
        </section>
      )}

      {/* COMPLETE: winner + final standings */}
      {pool.status === "complete" && (
        <section className="mt-8 space-y-6">
          {pool.winning_team_id ? (
            <WinnerBanner
              team={teamById.get(pool.winning_team_id)}
              holder={winnerHolder}
              userMap={userMap}
            />
          ) : (
            <div className="glass-card rounded-xl p-6 text-center text-sm text-on-surface-variant">
              Draft complete. The owner sets the winning team once the World
              Cup final is decided — whoever holds that nation takes the pool.
            </div>
          )}

          {isOwner && (
            <WinnerSetter
              poolId={pool.id}
              teams={teamList}
              current={pool.winning_team_id}
            />
          )}

          <PoolBody
            members={members}
            picksByUser={picksByUser}
            userMap={userMap}
            ownerId={pool.owner_id}
            remainingCount={remainingCount}
            winnerHolder={winnerHolder}
            winningTeamId={pool.winning_team_id}
            status={pool.status}
            scoreboard={scoreboard}
          />
        </section>
      )}

      {/* Owner danger zone — available in every state */}
      {isOwner && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-error/20 bg-error-container/10 p-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-error">
              Danger zone
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Deleting the pool removes the invite link, all members, and every
              drafted team. No undo.
            </p>
          </div>
          <DeletePoolButton poolId={pool.id} poolName={pool.name} />
        </div>
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

function Avatar({
  user,
  size = "md",
}: {
  user: DisplayUser | undefined;
  size?: "sm" | "md";
}) {
  const cls =
    size === "sm"
      ? "h-5 w-5 rounded-full border border-white/10 object-cover"
      : "h-9 w-9 rounded-full border border-primary/30 object-cover";
  if (user?.imageUrl) {
    return <img src={user.imageUrl} alt={user.name} className={cls} />;
  }
  return (
    <span
      className={`${cls} flex items-center justify-center bg-surface-variant text-[10px] font-bold uppercase`}
    >
      {(user?.name ?? "?").slice(0, 1)}
    </span>
  );
}

function AvatarStack({
  members,
  userMap,
}: {
  members: Member[];
  userMap: Map<string, DisplayUser>;
}) {
  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((m) => {
        const u = userMap.get(m.user_id);
        return u?.imageUrl ? (
          <img
            key={m.user_id}
            src={u.imageUrl}
            alt={u.name}
            title={u.name}
            className="h-7 w-7 rounded-full border-2 border-background object-cover"
          />
        ) : (
          <span
            key={m.user_id}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-surface-variant text-[10px] font-bold uppercase"
          >
            {(u?.name ?? "?").slice(0, 1)}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-surface-variant text-[10px] font-bold">
          +{extra}
        </span>
      )}
    </div>
  );
}

function WinnerBanner({
  team,
  holder,
  userMap,
}: {
  team: Team | undefined;
  holder: string | undefined;
  userMap: Map<string, DisplayUser>;
}) {
  if (!team) return null;
  return (
    <div className="gold-glow glass-card rounded-xl border-secondary-fixed/40 p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-fixed">
        🏆 World Cup Winner
      </p>
      <img
        src={flagUrl(team.code, "w320")}
        alt={team.name}
        className="mx-auto mt-4 h-16 w-auto rounded shadow-xl"
      />
      <p className="mt-3 font-display text-3xl font-bold uppercase italic">
        {team.name}
      </p>
      <p className="mt-2 text-on-surface-variant">
        Held by{" "}
        <strong className="text-secondary-fixed">
          {holder ? (userMap.get(holder)?.name ?? "Member") : "nobody"}
        </strong>{" "}
        — they win the pool!
      </p>
    </div>
  );
}

function WinnerSetter({
  poolId,
  teams,
  current,
}: {
  poolId: string;
  teams: Team[];
  current: string | null;
}) {
  const sorted = [...teams].sort(
    (a, b) =>
      a.wc_group.localeCompare(b.wc_group) || a.name.localeCompare(b.name),
  );
  return (
    <form action={setWinningTeam} className="glass-card rounded-xl p-6">
      <h2 className="font-display text-lg font-semibold uppercase italic">
        {current ? "Change winning team" : "Set the winning team"}
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Owner only — choose the nation that won the World Cup.
      </p>
      <input type="hidden" name="poolId" value={poolId} />
      <div className="mt-4 flex gap-2">
        <select
          name="teamId"
          required
          defaultValue={current ?? ""}
          className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
        >
          <option value="" disabled>
            Select a team…
          </option>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              {t.wc_group} · {t.name}
            </option>
          ))}
        </select>
        <SubmitButton
          pendingLabel="Saving…"
          className="shrink-0 rounded-lg bg-secondary-container px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-secondary-container transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Save winner
        </SubmitButton>
      </div>
    </form>
  );
}

// Standings table + "Pool Pulse" stats, shared by the locked and complete
// views. Members are ranked by the live points of the nations they hold.
function PoolBody({
  members,
  picksByUser,
  userMap,
  ownerId,
  remainingCount,
  winnerHolder,
  winningTeamId,
  status,
  scoreboard,
}: {
  members: Member[];
  picksByUser: Map<string, Team[]>;
  userMap: Map<string, DisplayUser>;
  ownerId: string;
  remainingCount: number;
  winnerHolder: string | undefined;
  winningTeamId: string | null;
  status: string;
  scoreboard: Scoreboard | null;
}) {
  const claimedCount = 48 - remainingCount;
  const board: Scoreboard = scoreboard ?? {
    byTeamName: new Map(),
    matchesPlayed: 0,
    totalMatches: 104,
    ok: false,
  };
  const hasResults = board.matchesPlayed > 0;

  // Rank members by total points of their nations; FIFA-style tiebreakers
  // (goal difference, then goals scored), then name for stability.
  const rows = members
    .map((m) => {
      const teams = [...(picksByUser.get(m.user_id) ?? [])].sort(
        (a, b) =>
          teamScore(board, b.name).points - teamScore(board, a.name).points ||
          a.name.localeCompare(b.name),
      );
      let points = 0;
      let gd = 0;
      let gf = 0;
      for (const t of teams) {
        const s = teamScore(board, t.name);
        points += s.points;
        gd += s.gf - s.ga;
        gf += s.gf;
      }
      return { member: m, teams, points, gd, gf };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        (userMap.get(a.member.user_id)?.name ?? "").localeCompare(
          userMap.get(b.member.user_id)?.name ?? "",
        ),
    );

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Standings */}
      <div className="glass-card overflow-hidden rounded-xl lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-6 py-4">
          <h2 className="font-display text-lg font-semibold uppercase italic">
            Live rankings
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            3 pts a win · 1 a draw
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="py-3 pl-6 pr-2 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Nations</th>
                <th className="py-3 pl-4 pr-6 text-right font-semibold">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(({ member: m, teams, points, gd }, i) => {
                const u = userMap.get(m.user_id);
                const isWinner =
                  winnerHolder !== undefined && m.user_id === winnerHolder;
                const done =
                  m.teams_allotted > 0 && teams.length >= m.teams_allotted;
                return (
                  <tr
                    key={m.user_id}
                    className={
                      isWinner
                        ? "border-y-2 border-secondary-fixed/30 bg-secondary-fixed/10"
                        : "transition-colors hover:bg-white/5"
                    }
                  >
                    <td className="py-4 pl-6 pr-2">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div>
                          <div
                            className={`font-bold ${isWinner ? "text-secondary-fixed" : ""}`}
                          >
                            {u?.name ?? "Member"}
                            {isWinner && " 🏆"}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                            {m.user_id === ownerId ? "Owner · " : ""}
                            {done
                              ? `${teams.length}/${m.teams_allotted} drafted`
                              : status === "locked"
                                ? `Drafting ${teams.length}/${m.teams_allotted}`
                                : "Member"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-md flex-wrap gap-1.5">
                        {teams.length === 0 && (
                          <span className="text-xs text-on-surface-variant">
                            No teams yet
                          </span>
                        )}
                        {teams.map((t) => {
                          const s = teamScore(board, t.name);
                          return (
                            <span
                              key={t.id}
                              title={`Group ${t.wc_group} · ${s.wins}W ${s.draws}D ${s.losses}L`}
                              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                                t.id === winningTeamId
                                  ? "border-secondary-fixed/60 bg-secondary-fixed/15 font-bold text-secondary-fixed"
                                  : "border-white/10 bg-surface-container"
                              }`}
                            >
                              <img
                                src={flagUrl(t.code, "w80")}
                                alt={t.name}
                                className="h-3.5 w-auto rounded-sm"
                              />
                              {t.name}
                              {hasResults && (
                                <span
                                  className={`font-display ${
                                    s.points > 0
                                      ? "text-secondary-fixed"
                                      : "text-on-surface-variant"
                                  }`}
                                >
                                  {s.points}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 pl-4 pr-6 text-right">
                      <div className="font-display text-2xl font-semibold text-secondary-fixed">
                        {points}
                      </div>
                      {hasResults && (
                        <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                          GD {gd > 0 ? `+${gd}` : gd}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/5 bg-surface-container-low/30 px-6 py-3 text-[10px] uppercase tracking-widest text-on-surface-variant">
          {board.ok
            ? hasResults
              ? `Live results · ${board.matchesPlayed}/${board.totalMatches} matches played · knockout wins (incl. pens) count 3`
              : "No results yet — rankings update as matches finish"
            : "Live results temporarily unavailable — showing last known points"}
        </div>
      </div>

      {/* Pool Pulse */}
      <aside className="space-y-5">
        <div className="glass-card relative overflow-hidden rounded-xl p-6">
          <div className="absolute -right-4 -top-4 text-[100px] opacity-10">
            🏆
          </div>
          <h3 className="font-display text-lg font-semibold uppercase italic">
            Pool Pulse
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-on-surface-variant">Teams claimed</span>
                <span className="text-secondary-fixed">
                  {claimedCount}/48
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full bg-secondary-fixed"
                  style={{ width: `${(claimedCount / 48) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-on-surface-variant">
                  Tournament progress
                </span>
                <span className="text-primary">
                  {board.matchesPlayed}/{board.totalMatches}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${(board.matchesPlayed / Math.max(board.totalMatches, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Players
                </p>
                <p className="font-display text-2xl text-primary">
                  {members.length}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Unclaimed
                </p>
                <p className="font-display text-2xl text-secondary-fixed">
                  {remainingCount}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              <span className="text-secondary-fixed">ℹ️</span> Nations earn 3
              points per win and 1 per draw (knockout wins count 3, even on
              penalties). Your score is the sum across all your nations —
              results refresh every few minutes. Whoever holds the World Cup
              champion wins the pool.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? "bg-secondary-fixed text-black"
      : rank === 2
        ? "bg-slate-300 text-black"
        : rank === 3
          ? "bg-amber-700 text-white"
          : "bg-surface-variant text-on-surface-variant";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${style}`}
    >
      {rank}
    </span>
  );
}
