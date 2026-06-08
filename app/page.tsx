import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { createClient } from "@/utils/supabase/server";
import { createPool, joinPoolByCode } from "@/lib/actions";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  locked: "Drafting",
  complete: "Complete",
};

type Pool = { id: string; name: string; status: string };

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
        <div className="text-6xl">🎡⚽️</div>
        <h1 className="text-4xl font-bold tracking-tight">Spin the World Cup</h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Create a pool, invite your friends, and draft all 48 nations with a
          slot-machine wheel. Hold the team that lifts the trophy and win the pool.
        </p>
        <SignInButton>
          <button className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white dark:bg-white dark:text-zinc-900">
            Sign in to play
          </button>
        </SignInButton>
      </div>
    );
  }

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
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Your pools</h1>

      {pools.length === 0 ? (
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          You&apos;re not in any pools yet. Create one or join with an invite code.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {pools.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pools/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="font-medium">{p.name}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <form
          action={createPool}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="font-semibold">Create a pool</h2>
          <input
            name="name"
            required
            placeholder="e.g. Office Pool 2026"
            className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="mt-3 w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-zinc-900">
            Create
          </button>
        </form>

        <form
          action={joinPoolByCode}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="font-semibold">Join a pool</h2>
          <input
            name="code"
            required
            placeholder="invite code"
            className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="mt-3 w-full rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700">
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
