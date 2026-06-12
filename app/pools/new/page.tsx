import { createPool } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

// "Create New Pool" — gamified setup form from the Stitch mockups, wired to
// the real createPool action. Only real rules are shown (no fake stakes).
export default function NewPoolPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-10">
        <div className="absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full bg-primary blur-[120px]" />
        <div className="absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full bg-secondary-fixed blur-[100px]" />
      </div>
      <section className="relative z-10 mx-auto w-full max-w-2xl px-4 py-12 md:px-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold uppercase italic tracking-tight md:text-4xl">
            Create New Pool
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Name it, invite the squad, and let the wheel decide.
          </p>
        </div>

        <form action={createPool} className="space-y-6">
          {/* Step 1: Identity */}
          <div className="glass-card space-y-5 rounded-xl p-6">
            <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-display font-bold text-primary">
                01
              </span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
                Pool Identity
              </h2>
            </div>
            <div className="space-y-2">
              <label
                className="block px-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                htmlFor="pool-name"
              >
                Pool name
              </label>
              <input
                id="pool-name"
                name="name"
                required
                placeholder="e.g. The Office Bracket"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-4 outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label
                className="block px-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                htmlFor="pool-target"
              >
                Planned squad size <span className="text-outline">(optional)</span>
              </label>
              <input
                id="pool-target"
                name="target_size"
                type="number"
                min={1}
                max={48}
                placeholder="e.g. 10"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-4 outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
              />
              <p className="px-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
                Just a target — shows joiners &quot;4 of 10 spots taken&quot;.
                You can lock earlier or let it grow.
              </p>
            </div>
            <div className="space-y-2">
              <label
                className="block px-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
                htmlFor="pool-notes"
              >
                Notes <span className="text-outline">(optional)</span>
              </label>
              <textarea
                id="pool-notes"
                name="notes"
                rows={2}
                maxLength={500}
                placeholder="e.g. Entry fee: $20 — Venmo the owner before kickoff, winner takes all"
                className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-4 outline-none transition-colors placeholder:text-outline/60 focus:border-primary"
              />
              <p className="px-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
                Shown to everyone in the pool and on the invite page
              </p>
            </div>
          </div>

          {/* Step 2: Spin rules (informational — these are the house rules) */}
          <div className="glass-card space-y-4 rounded-xl p-6">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 font-display font-bold text-primary">
                  02
                </span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
                  Spin Rules
                </h2>
              </div>
              <span className="animate-spin-slow inline-block text-xl">🎰</span>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest/50 p-4">
              <div>
                <h3 className="text-sm font-bold">Random allocation</h3>
                <p className="mt-1 text-xs leading-snug text-on-surface-variant">
                  When you lock the pool, all 48 nations are split evenly —
                  leftover teams go to randomly chosen members.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                Always on
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest/50 p-4">
              <div>
                <h3 className="text-sm font-bold">Invite only</h3>
                <p className="mt-1 text-xs leading-snug text-on-surface-variant">
                  Players join with your pool&apos;s invite link until you lock
                  it. Once locked, the roster is frozen and the spinning starts.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-secondary-fixed/30 bg-secondary-fixed/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary-fixed">
                House rule
              </span>
            </div>

            <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-highest/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                <span className="text-primary">ℹ️</span> Pool capacity
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-lowest">
                <div className="h-full w-[2%] rounded-full bg-secondary-fixed" />
              </div>
              <div className="mt-2 flex justify-between font-display text-sm">
                <span className="text-secondary-fixed">
                  48 team slots to claim
                </span>
                <span className="text-on-surface-variant">Up to 48 players</span>
              </div>
            </div>
          </div>

          {/* Final action */}
          <div className="pt-2">
            <SubmitButton
              pendingLabel="Creating pool…"
              className="w-full rounded-xl bg-primary py-5 font-display text-xl font-bold uppercase italic tracking-widest text-on-primary shadow-[0_0_30px_rgba(130,219,111,0.3)] transition-all hover:shadow-[0_0_50px_rgba(130,219,111,0.5)] active:scale-[0.98] disabled:opacity-60"
            >
              Create &amp; Invite Squad →
            </SubmitButton>
            <p className="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
              One pool · One invite link · One draft — you&apos;ll be the owner
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
