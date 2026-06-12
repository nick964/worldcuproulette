/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { createClient } from "@/utils/supabase/server";
import { flagUrl } from "@/lib/flags";

// Public landing page ("/") for everyone — CTAs adapt to auth state.
// The signed-in pools dashboard lives at /pools.
export default async function Home() {
  const { userId } = await auth();
  const signedIn = Boolean(userId);

  // All 48 nations for the hero reel (teams are world-readable reference
  // data); falls back to the contender list if the DB isn't seeded yet.
  const { data: teams } = await createClient()
    .from("teams")
    .select("name, code")
    .order("name");
  const reelFlags = teams?.length ? teams : WALL_FLAGS;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 opacity-15">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary blur-[120px]" />
          <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-secondary-fixed blur-[100px]" />
        </div>
        <div className="relative z-10 mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-12 px-4 py-16 md:px-8 lg:grid-cols-12 lg:py-24">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-4 py-1.5">
              <span className="live-dot" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                World Cup 2026 · 48 Nations
              </span>
            </div>
            <h1 className="font-display text-5xl font-bold uppercase italic leading-none md:text-7xl xl:text-8xl">
              Win the Cup
              <br />
              <span className="text-primary">by luck.</span>
            </h1>
            <p className="max-w-xl text-lg text-on-surface-variant">
              The random-team World Cup pool. Spin the roulette wheel, get your
              nations, and ride your luck all the way to the final. No skill.
              No spreadsheets. Pure chaos.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              {signedIn ? (
                <>
                  <Link
                    href="/pools"
                    className="pitch-glow rounded-xl bg-primary px-8 py-4 text-center font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95"
                  >
                    Go to my pools
                  </Link>
                  <Link
                    href="/pools/new"
                    className="rounded-xl border border-secondary-fixed px-8 py-4 text-center font-display text-lg font-bold uppercase tracking-wider text-secondary-fixed transition-colors hover:bg-secondary-fixed/10"
                  >
                    Create a pool
                  </Link>
                </>
              ) : (
                <>
                  <SignUpButton>
                    <button className="pitch-glow rounded-xl bg-primary px-8 py-4 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95">
                      Create your pool
                    </button>
                  </SignUpButton>
                  <SignInButton>
                    <button className="rounded-xl border border-secondary-fixed px-8 py-4 font-display text-lg font-bold uppercase tracking-wider text-secondary-fixed transition-colors hover:bg-secondary-fixed/10">
                      Sign in
                    </button>
                  </SignInButton>
                </>
              )}
            </div>
            <p className="text-sm italic text-on-surface-variant">
              Free to play — the only stake is{" "}
              <span className="font-bold text-secondary-fixed">
                bragging rights
              </span>
              .
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="relative mx-auto flex aspect-square max-w-md items-center justify-center">
              <div className="animate-spin-slow absolute inset-0 rounded-full border-[18px] border-dashed border-primary opacity-20" />
              <HeroFlagReel flags={reelFlags} />
              <div className="glass-card absolute bottom-6 right-0 animate-bounce rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Next spin
                </p>
                <p className="font-display text-lg text-secondary-fixed">
                  Could be Brazil…
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
          <div className="mb-10 space-y-2 text-center">
            <h2 className="font-display text-3xl font-semibold uppercase italic md:text-5xl">
              How World Cup Roulette works
            </h2>
            <div className="mx-auto h-1 w-24 bg-primary" />
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="glass-card group rounded-xl p-6 transition-all duration-300 hover:-translate-y-2">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-primary-container text-3xl">
                ➕
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold uppercase">
                1. Create a pool
              </h3>
              <p className="text-on-surface-variant">
                Name your pool and share its invite link. One pool, one invite,
                one draft — from office rivals to the family group chat.
              </p>
            </div>
            <div className="glass-card group rounded-xl p-6 transition-all duration-300 hover:-translate-y-2">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-primary-container text-3xl">
                👥
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold uppercase">
                2. Friends join
              </h3>
              <p className="text-on-surface-variant">
                Everyone joins with the link. When the squad is in, the owner
                locks the pool and all 48 nations are split fairly.
              </p>
            </div>
            <div className="glass-card group rounded-xl border-primary p-6 transition-all duration-300 hover:-translate-y-2">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-secondary-container text-3xl transition-all group-hover:shadow-[0_0_20px_rgba(255,219,60,0.5)]">
                🎰
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold uppercase text-secondary-fixed">
                3. Spin for nations
              </h3>
              <p className="text-on-surface-variant">
                Spin the wheel to draw your teams — Brazil or a wild underdog,
                it&apos;s all in the spin. Hold the champion, win the pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pure luck section */}
      <section className="overflow-hidden bg-background py-16 lg:py-24">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-12 px-4 md:px-8 lg:grid-cols-2">
          <FlagWall />
          <div className="space-y-6">
            <h2 className="font-display text-4xl font-semibold uppercase italic leading-tight md:text-6xl">
              Pure luck.
              <br />
              <span className="text-secondary-fixed">Zero skill.</span>
            </h2>
            <p className="text-lg text-on-surface-variant">
              Ditch the punditry and the prediction spreadsheets. Your squad is
              whatever the wheel says it is. When the whistle blows in June
              2026, your randomly drawn nations become your ticket to glory —
              or your group chat&apos;s favorite punchline.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="text-primary">✔</span>
                <span>
                  Server-side spins — atomic picks, no duplicates, no do-overs
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-primary">✔</span>
                <span>Fair split — all 48 nations dealt across your pool</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-primary">✔</span>
                <span>
                  One winner — hold the champion and take the bragging rights
                </span>
              </li>
            </ul>
            <div className="pt-2">
              {signedIn ? (
                <Link
                  href="/pools"
                  className="group inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-primary"
                >
                  Back to my pools
                  <span className="transition-transform group-hover:translate-x-2">
                    →
                  </span>
                </Link>
              ) : (
                <SignInButton>
                  <button className="group inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-primary">
                    Got an invite link? Sign in to join
                    <span className="transition-transform group-hover:translate-x-2">
                      →
                    </span>
                  </button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-outline-variant bg-surface-container-high py-10">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap justify-around gap-8 px-4 text-center md:px-8">
          <div>
            <p className="font-display text-5xl font-bold leading-none text-primary">
              48
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Nations
            </p>
          </div>
          <div>
            <p className="font-display text-5xl font-bold leading-none text-secondary-fixed">
              104
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Matches
            </p>
          </div>
          <div>
            <p className="font-display text-5xl font-bold leading-none text-primary">
              1
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Trophy
            </p>
          </div>
          <div>
            <p className="font-display text-5xl font-bold leading-none">∞</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Bragging rights
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-20 text-center">
        <div className="pointer-events-none absolute inset-0 z-0 opacity-10">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-2xl space-y-6 px-4">
          <h2 className="font-display text-4xl font-bold uppercase italic md:text-6xl">
            Ready to ride
            <br />
            <span className="text-primary">your luck?</span>
          </h2>
          <p className="text-on-surface-variant">
            The wheel doesn&apos;t care about FIFA rankings. Neither should
            you.
          </p>
          <div className="flex justify-center pt-2">
            {signedIn ? (
              <Link
                href="/pools/new"
                className="pitch-glow rounded-xl bg-primary px-10 py-4 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95"
              >
                Spin up a pool
              </Link>
            ) : (
              <SignUpButton>
                <button className="pitch-glow rounded-xl bg-primary px-10 py-4 font-display text-lg font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95">
                  Spin up a pool
                </button>
              </SignUpButton>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// The hero roulette: all 48 nation flags scrolling through the gold ring.
// Pure CSS marquee (strip rendered twice, scrolled -50%); pauses on hover.
function HeroFlagReel({ flags }: { flags: { name: string; code: string }[] }) {
  return (
    <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-secondary-fixed bg-surface-container-lowest shadow-[0_0_60px_rgba(255,225,109,0.35)] md:h-80 md:w-80">
      <div className="animate-flag-reel flex flex-col">
        {[...flags, ...flags].map((f, i) => (
          <img
            key={`${f.code}-${i}`}
            src={flagUrl(f.code, "w320")}
            alt={f.name}
            title={f.name}
            className="aspect-[3/2] w-full object-cover"
            draggable={false}
          />
        ))}
      </div>
      {/* center marker, echoing the draft wheel */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0.5 -translate-y-1/2 bg-primary/80" />
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_20px_40px_rgba(11,16,9,0.8),inset_0_-20px_40px_rgba(11,16,9,0.8)]" />
    </div>
  );
}

// A tilted wall of contender flags with a "live draw" card — stands in for the
// mockup's stock photography using the same flag assets the app already uses.
const WALL_FLAGS: { code: string; name: string }[] = [
  { code: "br", name: "Brazil" },
  { code: "ar", name: "Argentina" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "es", name: "Spain" },
  { code: "gb-eng", name: "England" },
  { code: "pt", name: "Portugal" },
  { code: "us", name: "United States" },
  { code: "mx", name: "Mexico" },
  { code: "ca", name: "Canada" },
  { code: "jp", name: "Japan" },
  { code: "ma", name: "Morocco" },
];

function FlagWall() {
  return (
    <div className="relative">
      <div className="glass-card rotate-[-2deg] rounded-xl p-6 transition-transform duration-300 hover:rotate-0">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {WALL_FLAGS.map((f, i) => (
            <img
              key={f.code}
              src={flagUrl(f.code, "w320")}
              alt={f.name}
              title={f.name}
              className={`aspect-[3/2] w-full rounded-lg object-cover shadow-lg ${
                i % 3 === 1 ? "translate-y-2" : ""
              }`}
            />
          ))}
        </div>
      </div>
      <div className="glass-card absolute -bottom-5 left-1/2 w-[85%] -translate-x-1/2 rounded-xl border-primary/30 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
            <span className="live-dot" /> Live draw
          </span>
          <span className="font-display text-lg uppercase text-secondary-fixed">
            Who gets Brazil?
          </span>
        </div>
      </div>
    </div>
  );
}
