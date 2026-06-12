import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { joinPool } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

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
    | {
        id: string;
        name: string;
        status: string;
        member_count: number;
        notes: string | null;
      }
    | undefined;

  if (!preview) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="text-5xl">🎟️</div>
        <h1 className="mt-4 font-display text-2xl font-bold uppercase italic">
          Invalid invite
        </h1>
        <p className="mt-3 text-on-surface-variant">
          This invite link isn&apos;t valid or has expired.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-xs font-bold uppercase tracking-widest text-primary hover:underline"
        >
          ← Back home
        </Link>
      </div>
    );
  }

  const open = preview.status === "open";
  const joinThisPool = joinPool.bind(null, code);

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="glass-card rounded-xl p-8 text-center">
        <div className="text-5xl">🎟️</div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          You&apos;re invited to join
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase italic">
          {preview.name}
        </h1>
        <p className="mt-2 text-on-surface-variant">
          {preview.member_count}{" "}
          {Number(preview.member_count) === 1 ? "player" : "players"} in so
          far.
        </p>

        {preview.notes && (
          <div className="mt-5 rounded-lg border border-secondary-fixed/20 bg-secondary-fixed/5 p-4 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
              📌 Pool notes
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-on-surface">
              {preview.notes}
            </p>
          </div>
        )}

        {open ? (
          <form action={joinThisPool} className="mt-8">
            <SubmitButton
              pendingLabel="Joining…"
              className="pitch-glow w-full rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95 disabled:opacity-60"
            >
              Join pool
            </SubmitButton>
          </form>
        ) : (
          <div className="mt-8">
            <p className="text-sm text-secondary-fixed">
              This pool has already started — new players can&apos;t join.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-primary hover:underline"
            >
              ← Back home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
