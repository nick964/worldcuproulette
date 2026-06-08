import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { joinPool } from "@/lib/actions";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createClient();

  const { data: previews } = await supabase.rpc("pool_preview", {
    p_code: code,
  });
  const preview = (previews ?? [])[0] as
    | { id: string; name: string; status: string; member_count: number }
    | undefined;

  if (!preview) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Invalid invite</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          This invite link isn&apos;t valid or has expired.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm hover:underline">
          ← Back home
        </Link>
      </div>
    );
  }

  const open = preview.status === "open";
  const joinThisPool = joinPool.bind(null, code);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="text-5xl">🎟️</div>
      <h1 className="mt-4 text-2xl font-bold">Join “{preview.name}”</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {preview.member_count}{" "}
        {Number(preview.member_count) === 1 ? "member" : "members"} so far.
      </p>

      {open ? (
        <form action={joinThisPool} className="mt-8">
          <button className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white dark:bg-white dark:text-zinc-900">
            Join pool
          </button>
        </form>
      ) : (
        <div className="mt-8">
          <p className="text-amber-600">
            This pool has already started — new members can&apos;t join.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm hover:underline">
            ← Back home
          </Link>
        </div>
      )}
    </div>
  );
}
