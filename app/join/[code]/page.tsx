import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { createClient } from "@/utils/supabase/server";
import { joinPool } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

// Public page: invitees usually have no account yet. Signed-out visitors see
// the pool preview with a create-account CTA; after the Clerk modal they land
// back here with ?welcome=1 and are joined automatically.
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { code } = await params;
  const { welcome } = await searchParams;
  const { userId } = await auth();
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
        target_size: number | null;
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

  // Fresh from the sign-up/sign-in modal: finish the join without another
  // click. join_pool is idempotent, so a re-visit just redirects again.
  if (userId && welcome && open) {
    const { data: joinedPoolId } = await supabase.rpc("join_pool", {
      p_code: code,
    });
    if (joinedPoolId) redirect(`/pools/${joinedPoolId}`);
  }

  const joinThisPool = joinPool.bind(null, code);
  const returnUrl = `/join/${code}?welcome=1`;

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
          {preview.target_size &&
          Number(preview.member_count) < preview.target_size ? (
            <>
              <strong className="text-secondary-fixed">
                {preview.member_count} of {preview.target_size}
              </strong>{" "}
              spots taken.
            </>
          ) : (
            <>
              {preview.member_count}{" "}
              {Number(preview.member_count) === 1 ? "player" : "players"} in
              so far.
            </>
          )}
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

        {!open ? (
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
        ) : userId ? (
          <form action={joinThisPool} className="mt-8">
            <SubmitButton
              pendingLabel="Joining…"
              className="pitch-glow w-full rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95 disabled:opacity-60"
            >
              Join pool
            </SubmitButton>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <SignUpButton mode="modal" forceRedirectUrl={returnUrl}>
              <button className="pitch-glow w-full rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95">
                Create account &amp; take your first spin
              </button>
            </SignUpButton>
            <p className="text-xs text-on-surface-variant">
              Free to play — takes about 30 seconds.
            </p>
            <p className="text-sm text-on-surface-variant">
              Already have an account?{" "}
              <SignInButton mode="modal" forceRedirectUrl={returnUrl}>
                <button className="font-bold text-primary hover:underline">
                  Sign in
                </button>
              </SignInButton>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
