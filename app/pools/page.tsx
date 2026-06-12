import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { joinPoolByCode, updateDisplayName } from "@/lib/actions";
import { StatusChip } from "@/components/status-chip";
import { SubmitButton } from "@/components/submit-button";

type Pool = { id: string; name: string; status: string };

// "My Pools" dashboard. Route is auth-protected by proxy.ts; the public
// landing page lives at "/".
export default async function PoolsPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const hasName = Boolean(user?.firstName || user?.lastName);
  const currentName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");

  const supabase = createClient();
  const { data: memberships } = await supabase
    .from("pool_members")
    .select("role, pool:pools(id, name, status)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  const pools = (memberships ?? [])
    .map((m) => ({ role: m.role, ...(m.pool as unknown as Pool) }))
    .filter((p) => p.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <span className="live-dot" />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          World Cup 2026
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold uppercase italic tracking-tight md:text-4xl">
          My Pools
        </h1>
        <Link
          href="/pools/new"
          className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
        >
          + Create Pool
        </Link>
      </div>

      {hasName && (
        <details className="mt-4">
          <summary className="cursor-pointer list-none text-xs uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary">
            Playing as{" "}
            <span className="font-bold text-on-surface">{currentName}</span>
            {" · "}
            <span className="underline decoration-dotted underline-offset-2">
              edit display name
            </span>
          </summary>
          <form
            action={updateDisplayName}
            className="glass-card mt-3 flex max-w-md gap-2 rounded-xl p-4"
          >
            <input
              name="name"
              required
              maxLength={60}
              defaultValue={currentName}
              className="w-full min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            />
            <SubmitButton
              pendingLabel="Saving…"
              className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Update
            </SubmitButton>
          </form>
        </details>
      )}

      {!hasName && (
        <form
          action={updateDisplayName}
          className="glass-card mt-6 rounded-xl border-secondary-fixed/30 p-6"
        >
          <h2 className="font-display text-lg font-semibold uppercase italic text-secondary-fixed">
            👋 Pick a display name
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Right now your pools show your email address. Set a name so your
            rivals know who&apos;s beating them.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              name="name"
              required
              maxLength={60}
              placeholder="e.g. Nick R"
              className="w-full min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-outline focus:border-primary"
            />
            <SubmitButton
              pendingLabel="Saving…"
              className="shrink-0 rounded-lg bg-secondary-container px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-secondary-container transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Save name
            </SubmitButton>
          </div>
        </form>
      )}

      {pools.length === 0 ? (
        <div className="glass-card mt-6 rounded-xl p-8 text-center">
          <div className="text-4xl">🎰</div>
          <p className="mt-3 text-on-surface-variant">
            You&apos;re not in any pools yet. Create one or join with an invite
            code below.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {pools.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pools/${p.id}`}
                className="glass-card group flex items-center justify-between gap-4 rounded-xl p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-xl">
                    ⚽️
                  </span>
                  <div>
                    <div className="font-bold transition-colors group-hover:text-primary">
                      {p.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {p.role === "owner" ? "You run this pool" : "Member"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip status={p.status} />
                  <span className="text-on-surface-variant transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/pools/new"
          className="glass-card group flex flex-col justify-between gap-4 rounded-xl p-6 transition-colors hover:border-primary/40"
        >
          <div>
            <h2 className="font-display text-lg font-semibold uppercase italic">
              Create a pool
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Name it, share the invite link, lock it when the squad is in.
            </p>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary group-hover:underline">
            Start a new pool →
          </span>
        </Link>

        <form action={joinPoolByCode} className="glass-card rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold uppercase italic">
            Join a pool
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Got an invite code? Punch it in.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              name="code"
              required
              placeholder="invite code"
              className="w-full min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-outline focus:border-primary"
            />
            <SubmitButton
              pendingLabel="Joining…"
              className="shrink-0 rounded-lg border border-secondary-fixed/40 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-secondary-fixed transition-colors hover:bg-secondary-fixed/10 disabled:opacity-50"
            >
              Join
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
