/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getUserMap, displayName, type DisplayUser } from "@/lib/clerk";
import {
  leavePool,
  lockPool,
  setWinningTeam,
  updatePoolName,
  updatePoolNotes,
  updatePoolTargetSize,
} from "@/lib/actions";
import { flagUrl } from "@/lib/flags";
import {
  getScoreboard,
  teamScore,
  type Scoreboard,
} from "@/lib/scores";
import { winChanceLabel, favoriteRank } from "@/lib/odds";
import { Wheel } from "@/components/wheel";
import { InviteLink } from "@/components/invite-link";
import { DeletePoolButton } from "@/components/delete-pool";
import {
  KickMemberButton,
  AutoDraftButton,
} from "@/components/admin-member-actions";
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
    .select(
      "id, name, status, owner_id, invite_code, winning_team_id, notes, target_size",
    )
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
  // While the pool is open, every member gets one guaranteed early spin.
  const myPicks = userId ? (picksByUser.get(userId) ?? []) : [];
  const earlySpinAvailable =
    pool.status === "open" && isMember && myUsed === 0;

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
              Tournament: World Cup 2026 ·{" "}
              {pool.status === "open" && pool.target_size
                ? `${M}/${pool.target_size} players`
                : `${M} player${M === 1 ? "" : "s"}`}
            </span>
          </div>
          {isOwner && (
            <details className="mt-2">
              <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary">
                ✏️ Rename pool
              </summary>
              <form
                action={updatePoolName}
                className="mt-2 flex max-w-md gap-2"
              >
                <input type="hidden" name="poolId" value={pool.id} />
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={pool.name}
                  className="w-full min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
                <SubmitButton
                  pendingLabel="Saving…"
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Save
                </SubmitButton>
              </form>
            </details>
          )}
        </div>
        {pool.status === "open" && (
          <div className="w-full md:w-96">
            <InviteLink code={pool.invite_code} />
          </div>
        )}
      </div>

      {(pool.notes || isOwner) && (
        <div className="glass-card mt-5 rounded-xl border-secondary-fixed/20 p-4">
          {pool.notes ? (
            <div className="flex items-start gap-3">
              <span aria-hidden>📌</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
                  Pool notes
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-on-surface">
                  {pool.notes}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              📌 No pool notes yet — add the entry fee or house rules so every
              player sees them here and on the invite page.
            </p>
          )}
          {isOwner && (
            <details className="mt-2">
              <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary">
                ✏️ {pool.notes ? "Edit notes" : "Add notes"}
              </summary>
              <form action={updatePoolNotes} className="mt-3 space-y-2">
                <input type="hidden" name="poolId" value={pool.id} />
                <textarea
                  name="notes"
                  rows={2}
                  maxLength={500}
                  defaultValue={pool.notes ?? ""}
                  placeholder="e.g. Entry fee: $20 — Venmo the owner before kickoff, winner takes all"
                  className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
                />
                <div className="flex items-center gap-3">
                  <SubmitButton
                    pendingLabel="Saving…"
                    className="rounded-lg bg-secondary-container px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-secondary-container transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Save notes
                  </SubmitButton>
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Clear the text to remove the notes
                  </span>
                </div>
              </form>
            </details>
          )}
        </div>
      )}

      {/* OPEN: the guaranteed early first spin — no waiting around */}
      {earlySpinAvailable && (
        <section className="mt-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-semibold uppercase italic">
              No waiting — take your first spin now 🎡
            </h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-on-surface-variant">
              Every player draws their first nation the moment they join. The
              rest of your spins unlock when the pool locks.
            </p>
          </div>
          <div className="mt-4">
            <Wheel
              key={`early-${unclaimedTeams.length}`}
              poolId={pool.id}
              teams={unclaimedTeams}
              spinsLeft={1}
            />
          </div>
        </section>
      )}
      {pool.status === "open" && isMember && myUsed > 0 && (
        <div className="gold-glow glass-card mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border-secondary-fixed/30 p-5">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🎟️</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
                Your first nation is in
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {myPicks.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-2 rounded-full border border-secondary-fixed/40 bg-secondary-fixed/10 px-3 py-1.5 font-display font-semibold uppercase"
                  >
                    <img
                      src={flagUrl(t.code, "w160")}
                      alt={t.name}
                      className="h-4 w-auto rounded-sm"
                    />
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="max-w-xs text-xs text-on-surface-variant">
            We&apos;ll email you when the pool locks — any remaining spins
            unlock then.
          </p>
        </div>
      )}

      {/* OPEN: waiting room for non-owner members */}
      {pool.status === "open" && isMember && !isOwner && (
        <WaitingRoom
          ownerName={displayName(userMap, pool.owner_id)}
          memberCount={M}
          targetSize={pool.target_size}
          base={base}
          rem={rem}
          teams={teamList}
        />
      )}

      {/* OPEN: invite, manage membership, then lock */}
      {pool.status === "open" && (
        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="glass-card rounded-xl p-6 lg:col-span-2">
            <h2 className="font-display text-lg font-semibold uppercase italic">
              Roster ({M}
              {pool.target_size ? ` of ${pool.target_size}` : ""})
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Share the invite link above — membership freezes when the pool is
              locked.
            </p>
            {pool.target_size && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, (M / pool.target_size) * 100)}%`,
                  }}
                />
              </div>
            )}
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
                    {(picksByUser.get(m.user_id) ?? []).map((t) => (
                      <img
                        key={t.id}
                        src={flagUrl(t.code, "w80")}
                        alt={t.name}
                        title={`Already drew ${t.name}`}
                        className="h-3.5 w-auto rounded-sm"
                      />
                    ))}
                    {m.user_id === pool.owner_id && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-secondary-fixed">
                        Owner
                      </span>
                    )}
                    {isOwner && m.user_id !== pool.owner_id && (
                      <KickMemberButton
                        poolId={pool.id}
                        userId={m.user_id}
                        userName={displayName(userMap, m.user_id)}
                      />
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
              {pool.target_size && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Your target is {pool.target_size} players ({M} in so far) —
                  but it&apos;s not enforced. Lock whenever you&apos;re ready,
                  or let it grow.
                </p>
              )}
              <details className="mt-3">
                <summary className="inline-block cursor-pointer list-none rounded-lg border border-outline-variant px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary">
                  ✏️ {pool.target_size ? "Adjust" : "Set a"} target size
                </summary>
                <form
                  action={updatePoolTargetSize}
                  className="mt-2 space-y-2"
                >
                  <input type="hidden" name="poolId" value={pool.id} />
                  <div className="flex gap-2">
                    <input
                      name="target_size"
                      type="number"
                      min={1}
                      max={48}
                      list="even-split-sizes"
                      defaultValue={pool.target_size ?? ""}
                      placeholder="e.g. 12"
                      className="w-full min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                    />
                    <datalist id="even-split-sizes">
                      <option value="2" />
                      <option value="3" />
                      <option value="4" />
                      <option value="6" />
                      <option value="8" />
                      <option value="12" />
                      <option value="16" />
                      <option value="24" />
                      <option value="48" />
                    </datalist>
                    <SubmitButton
                      pendingLabel="Saving…"
                      className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      Save
                    </SubmitButton>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    💡 2, 3, 4, 6, 8, 12, 16, 24 or 48 players split the 48
                    teams evenly. Leave blank to remove the target.
                  </p>
                </form>
              </details>
              <p className="mt-2 text-xs text-on-surface-variant">
                Locking emails every member that the draft is open.
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
            poolId={pool.id}
            viewerIsOwner={isOwner}
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
            poolId={pool.id}
            viewerIsOwner={isOwner}
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
  poolId,
  viewerIsOwner,
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
  poolId: string;
  viewerIsOwner: boolean;
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
                          {viewerIsOwner && status === "locked" && !done && (
                            <div className="mt-2">
                              <AutoDraftButton
                                poolId={poolId}
                                userId={m.user_id}
                                userName={u?.name ?? "this member"}
                                remaining={m.teams_allotted - teams.length}
                              />
                            </div>
                          )}
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
                              title={`Group ${t.wc_group} · ${s.wins}W ${s.draws}D ${s.losses}L${
                                winChanceLabel(t.name)
                                  ? ` · #${favoriteRank(t.name)} favorite · ${winChanceLabel(t.name)} to win it all`
                                  : ""
                              }`}
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

// Pre-lock explainer for members who aren't the owner: what's happening now,
// how many spins they'll get, and a flag marquee to keep the hype up.
function WaitingRoom({
  ownerName,
  memberCount,
  targetSize,
  base,
  rem,
  teams,
}: {
  ownerName: string;
  memberCount: number;
  targetSize: number | null;
  base: number;
  rem: number;
  teams: Team[];
}) {
  const spinsLabel = rem === 0 ? `${base}` : `${base}–${base + 1}`;
  const statusLabel =
    targetSize && memberCount < targetSize
      ? `Pool open — ${memberCount} of ${targetSize} spots taken`
      : "Pool open — squad still assembling";
  return (
    <section className="glass-card mt-8 overflow-hidden rounded-xl">
      <div className="p-6">
        <div className="flex items-center gap-2 text-primary">
          <span className="live-dot" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {statusLabel}
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold uppercase italic">
          You&apos;re in! Now we wait.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
          This pool is still accepting players — anyone with the invite link
          can join until <strong className="text-on-surface">{ownerName}</strong>{" "}
          locks it.
          {targetSize
            ? ` The target is ${targetSize} players, but it's not a hard cap — the owner can lock earlier or let it grow.`
            : ""}{" "}
          At lock, all 48 nations are dealt out at random, and the spinning
          starts — you&apos;ll get an email the moment it happens.
        </p>
        <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-secondary-fixed/30 bg-secondary-fixed/10 px-4 py-3">
          <span className="text-2xl">🎡</span>
          <p className="text-sm">
            With <strong>{memberCount}</strong> player
            {memberCount === 1 ? "" : "s"} so far, you&apos;ll end up with{" "}
            <strong className="font-display text-lg text-secondary-fixed">
              {spinsLabel} nations
            </strong>
            {rem !== 0 && (
              <span className="text-on-surface-variant">
                {" "}
                ({rem} lucky player{rem === 1 ? "" : "s"} get an extra)
              </span>
            )}{" "}
            — the first is yours the moment you spin; the rest unlock at lock.
          </p>
        </div>
      </div>

      {/* All 48 nations drifting by — one of these is yours */}
      <div className="space-y-2 border-t border-white/5 bg-surface-container-lowest/50 py-4">
        <FlagMarqueeRow teams={teams} reverse={false} />
        <FlagMarqueeRow teams={[...teams].reverse()} reverse />
        <p className="px-6 pt-1 text-center text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
          Your future nations are in here somewhere…
        </p>
      </div>
    </section>
  );
}

function FlagMarqueeRow({
  teams,
  reverse,
}: {
  teams: Team[];
  reverse: boolean;
}) {
  return (
    <div className="overflow-hidden">
      <div
        className={`flex w-max gap-2 ${
          reverse ? "animate-flag-marquee-reverse" : "animate-flag-marquee"
        }`}
      >
        {[...teams, ...teams].map((t, i) => (
          <img
            key={`${t.id}-${i}`}
            src={flagUrl(t.code, "w160")}
            alt={t.name}
            title={`${t.name} · Group ${t.wc_group}${
              winChanceLabel(t.name)
                ? ` · ${winChanceLabel(t.name)} to win it all`
                : ""
            }`}
            className="h-10 w-auto rounded shadow-md"
            draggable={false}
          />
        ))}
      </div>
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
