import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { createClient } from "@/utils/supabase/server";
import { createGroup, joinGroupByCode } from "@/lib/actions";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
        <div className="text-6xl">🎡⚽️</div>
        <h1 className="text-4xl font-bold tracking-tight">Spin the World Cup</h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Create a group, invite your friends, and draft all 48 nations with a
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
    .from("group_members")
    .select("role, group:groups(id, name, invite_code)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  const groups = (memberships ?? [])
    .map((m) => ({ role: m.role, ...(m.group as unknown as Group) }))
    .filter((g) => g.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Your groups</h1>

      {groups.length === 0 ? (
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          You&apos;re not in any groups yet. Create one or join with an invite code.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-xs uppercase tracking-wide text-zinc-500">
                  {g.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <form
          action={createGroup}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="font-semibold">Create a group</h2>
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
          action={joinGroupByCode}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="font-semibold">Join a group</h2>
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

type Group = { id: string; name: string; invite_code: string };
