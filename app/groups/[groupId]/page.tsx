import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { getUserMap, displayName } from "@/lib/clerk";
import { createPool } from "@/lib/actions";
import { InviteLink } from "@/components/invite-link";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  locked: "Drafting",
  complete: "Complete",
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const userId = await auth().then((a) => a.userId);

  const supabase = createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, owner_id, invite_code")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) notFound();

  const [{ data: members }, { data: pools }] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("pools")
      .select("id, name, status, created_by")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);

  const userMap = await getUserMap((members ?? []).map((m) => m.user_id));
  const isOwner = group.owner_id === userId;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← All groups
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{group.name}</h1>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500">Invite link</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Share this so others can join the group.
        </p>
        <div className="mt-3">
          <InviteLink code={group.invite_code} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Members ({members?.length ?? 0})</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(members ?? []).map((m) => (
            <li
              key={m.user_id}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {displayName(userMap, m.user_id)}
              {m.role === "owner" && (
                <span className="ml-1 text-xs text-zinc-400">(owner)</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Pools</h2>
        {(pools ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No pools yet. Create the first draft below.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {(pools ?? []).map((p) => (
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

        <form
          action={createPool}
          className="mt-4 flex gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <input type="hidden" name="groupId" value={group.id} />
          <input
            name="name"
            required
            placeholder="New pool name"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-zinc-900">
            Create pool
          </button>
        </form>
      </section>

      {isOwner && (
        <p className="mt-6 text-xs text-zinc-400">You own this group.</p>
      )}
    </div>
  );
}
