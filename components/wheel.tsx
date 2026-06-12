"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { spinForTeam, type SpinResult } from "@/lib/actions";
import { flagUrl } from "@/lib/flags";
import { winChanceLabel } from "@/lib/odds";

type Team = { id: string; name: string; code: string; wc_group: string };

const SPIN_VELOCITY = 32; // px per frame while free-spinning (~1920 px/s @60fps)
const SPIN_PPS = SPIN_VELOCITY * 60; // px per second
// Reel travel after STOP before landing (~5s with the quartic ease: fast at
// first, then a long dramatic crawl onto the flag). The landing slot is
// rewritten to the server team while it's still offscreen, so we never need
// to travel a whole loop to reach it. Impatient? The Skip button stays.
const MIN_DECEL_DIST = 2400;

type Phase = "idle" | "spinning" | "stopping" | "drawing" | "revealed";

type Size = { itemW: number; flagW: number; flagH: number; bandH: number };

// Big, viewport-driven flags: tall and exciting, capped so they always fit.
function computeSize(): Size {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let flagW = Math.min(vh * 0.42 * 1.5, vw * 0.84);
  flagW = Math.max(240, Math.min(flagW, 760));
  const flagH = Math.round(flagW / 1.5);
  return {
    itemW: Math.round(flagW + 48),
    flagW: Math.round(flagW),
    flagH,
    bandH: flagH + 92,
  };
}

const DEFAULT_SIZE: Size = { itemW: 348, flagW: 300, flagH: 200, bandH: 292 };

type Decel = {
  from: number;
  dist: number;
  durMs: number;
  start: number;
  pow: number; // ease-out exponent: higher = longer suspense tail
  team: SpinResult;
};

export function Wheel({
  poolId,
  teams,
  spinsLeft,
}: {
  poolId: string;
  teams: Team[];
  spinsLeft: number;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const decelRef = useRef<Decel | null>(null);
  const skipRef = useRef(false);

  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [bulkResults, setBulkResults] = useState<SpinResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reel slot rewritten to the server-chosen team so the reel lands on it.
  const [override, setOverride] = useState<{
    index: number;
    team: SpinResult;
  } | null>(null);

  const { itemW, flagW, flagH, bandH } = size;
  const len = teams.length;
  const loopW = len * itemW;

  const repeats = useMemo(() => {
    const needPx = MIN_DECEL_DIST + 3 * loopW + 6000;
    return Math.max(8, Math.ceil(needPx / Math.max(loopW, 1)) + 2);
  }, [loopW]);
  const reel = useMemo(
    () => Array.from({ length: repeats }, () => teams).flat(),
    [teams, repeats],
  );

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const apply = () => {
    if (stripRef.current) {
      stripRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
    }
  };

  // Measure the viewport once mounted, and on resize while idle.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setSize(computeSize()));
    const onResize = () => {
      if (phaseRef.current === "idle") setSize(computeSize());
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Continuous loop: free-spins at constant speed (including while awaiting the
  // server after STOP), then eases out from the current speed onto the team.
  const step = (now: number) => {
    const decel = decelRef.current;
    if (decel) {
      if (decel.start === 0) decel.start = now; // stamped on the first frame
      const p = Math.min(1, (now - decel.start) / decel.durMs);
      const eased = 1 - Math.pow(1 - p, decel.pow);
      offsetRef.current = decel.from + decel.dist * eased;
      apply();
      if (p >= 1) {
        decelRef.current = null;
        setResult(decel.team);
        setPhaseBoth("revealed");
        return;
      }
    } else {
      offsetRef.current += SPIN_VELOCITY;
      if (offsetRef.current >= loopW) offsetRef.current -= loopW;
      apply();
    }
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startSpin = () => {
    if (len === 0 || spinsLeft <= 0) return;
    setError(null);
    setResult(null);
    setOverride(null);
    skipRef.current = false;
    decelRef.current = null;
    setPhaseBoth("spinning");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  const stop = async () => {
    if (phaseRef.current !== "spinning") return;
    skipRef.current = false;
    setPhaseBoth("stopping"); // reel keeps spinning while we ask the server

    let team: SpinResult;
    try {
      team = await spinForTeam(poolId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spin failed. Try again.");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPhaseBoth("idle");
      return;
    }

    if (skipRef.current) {
      // The user hit Skip while we were waiting for the server: stop the reel
      // and snap it straight onto the drawn team.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      snapToTeam(team);
      setResult(team);
      setPhaseBoth("revealed");
      return;
    }

    const window = containerRef.current?.clientWidth ?? 600;
    // Keep the rewritten slot offscreen: it must be past the right edge of the
    // band at the moment we swap it in.
    const minDist = Math.max(MIN_DECEL_DIST, window * 0.75);
    const current = offsetRef.current;
    // First reel slot whose center sits at least minDist past the marker.
    const slot = Math.ceil((current + minDist + window / 2 - itemW / 2) / itemW);
    const target = slot * itemW + itemW / 2 - window / 2;
    setOverride({ index: slot, team });
    const dist = target - current;
    // quartic ease-out; duration sized so the initial velocity matches the
    // spin speed, which buys a slow, dramatic final approach
    const durMs = ((4 * dist) / SPIN_PPS) * 1000;

    decelRef.current = { from: current, dist, durMs, start: 0, pow: 4, team };
  };

  // Skip the landing animation and reveal the team immediately.
  const skipLanding = () => {
    if (phaseRef.current !== "stopping") return;
    const decel = decelRef.current;
    if (!decel) {
      // Server hasn't answered yet — reveal as soon as it does.
      skipRef.current = true;
      return;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    offsetRef.current = decel.from + decel.dist;
    apply();
    decelRef.current = null;
    setResult(decel.team);
    setPhaseBoth("revealed");
  };

  // Center the reel on `team` with no animation (used by Skip).
  const snapToTeam = (team: SpinResult) => {
    const window = containerRef.current?.clientWidth ?? 600;
    const idx = teams.findIndex((t) => t.id === team.id);
    let slot: number;
    if (idx >= 0) {
      slot = idx + len; // second copy keeps the offset comfortably positive
    } else {
      // Concurrent pick removed it from the local list: rewrite a slot instead.
      slot = Math.floor((offsetRef.current + window) / itemW) + 1;
      setOverride({ index: slot, team });
    }
    offsetRef.current = slot * itemW + itemW / 2 - window / 2;
    apply();
  };

  // One pick without the full spin: draw server-side, then do a short, fast
  // slide onto the drawn flag (the first offscreen slot is rewritten to it).
  const quickPick = async () => {
    if (phaseRef.current !== "idle" || spinsLeft <= 0) return;
    setError(null);
    setResult(null);
    setOverride(null);
    setPhaseBoth("drawing");

    let team: SpinResult;
    try {
      team = await spinForTeam(poolId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw failed. Try again.");
      setPhaseBoth("idle");
      return;
    }

    const window = containerRef.current?.clientWidth ?? 600;
    const current = offsetRef.current;
    const slot = Math.floor((current + window) / itemW) + 1;
    setOverride({ index: slot, team });
    const target = slot * itemW + itemW / 2 - window / 2;
    decelRef.current = {
      from: current,
      dist: target - current,
      durMs: 700,
      start: 0,
      pow: 3, // quick pick stays snappy
      team,
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  // Draft every remaining spin at once, no animation.
  const draftAll = async () => {
    if (phaseRef.current !== "idle" || spinsLeft <= 0) return;
    setError(null);
    const drawn: SpinResult[] = [];
    setBulkResults([]);
    setPhaseBoth("drawing");
    try {
      for (let i = 0; i < spinsLeft; i++) {
        const team = await spinForTeam(poolId);
        drawn.push(team);
        setBulkResults([...drawn]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw failed. Try again.");
      if (drawn.length === 0) {
        setBulkResults(null);
        setPhaseBoth("idle");
        return;
      }
    }
    setPhaseBoth("revealed");
  };

  const noSpins = spinsLeft <= 0;
  const bulkMode = bulkResults !== null;

  return (
    <div>
      {/* Full-bleed reel band */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden border-y-2 border-primary/40 bg-gradient-to-b from-surface-container to-surface-container-lowest"
          style={{ height: bandH }}
        >
          {/* edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

          {/* center marker */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -ml-px w-0.5 bg-primary" />
          <div
            className="pointer-events-none absolute inset-y-2 left-1/2 z-20 -translate-x-1/2 rounded-2xl ring-4 ring-primary/70"
            style={{ width: itemW }}
          />

          <div
            ref={stripRef}
            className="flex h-full items-center will-change-transform"
          >
            {reel.map((t, i) => {
              const item = override && override.index === i ? override.team : t;
              return (
                <div
                  key={`${t.id}-${i}`}
                  className="flex shrink-0 flex-col items-center justify-center gap-2"
                  style={{ width: itemW }}
                >
                  <img
                    src={flagUrl(item.code, "w640")}
                    alt={item.name}
                    className="rounded-xl object-cover shadow-xl"
                    style={{ width: flagW, height: flagH }}
                    draggable={false}
                  />
                  <span
                    className="max-w-full truncate text-center font-display font-semibold uppercase tracking-wide text-on-surface-variant"
                    style={{ width: flagW }}
                  >
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex min-h-14 flex-col items-center justify-center gap-3">
        {phase === "idle" && !noSpins && (
          <>
            <button
              onClick={startSpin}
              className="pitch-glow rounded-full bg-primary px-12 py-4 font-display text-xl font-bold uppercase tracking-wider text-on-primary transition-transform active:scale-95"
            >
              Spin 🎡
            </button>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={quickPick}
                className="rounded-full border border-outline-variant px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
              >
                Quick pick — skip the spin
              </button>
              {spinsLeft > 1 && (
                <button
                  onClick={draftAll}
                  className="rounded-full border border-secondary-fixed/40 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-secondary-fixed transition-colors hover:bg-secondary-fixed/10"
                >
                  Draft all {spinsLeft} now
                </button>
              )}
            </div>
          </>
        )}
        {phase === "spinning" && (
          <button
            onClick={stop}
            className="animate-pulse rounded-full bg-secondary-container px-14 py-4 font-display text-2xl font-extrabold uppercase tracking-wide text-on-secondary-container shadow-lg"
          >
            STOP
          </button>
        )}
        {phase === "stopping" && (
          <div className="flex items-center gap-3">
            <button
              disabled
              className="rounded-full bg-surface-variant px-10 py-4 font-display text-lg font-bold uppercase text-on-surface-variant"
            >
              Landing…
            </button>
            <button
              onClick={skipLanding}
              className="rounded-full border border-outline-variant px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
            >
              Skip ⏭
            </button>
          </div>
        )}
        {phase === "drawing" && (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-pulse font-display text-lg font-bold uppercase tracking-wider text-on-surface-variant">
              {bulkMode
                ? `Drawing your nations… ${bulkResults.length}/${spinsLeft}`
                : "Drawing…"}
            </div>
            {bulkMode && bulkResults.length > 0 && (
              <BulkResultChips results={bulkResults} />
            )}
          </div>
        )}
        {phase === "revealed" && bulkMode && (
          <div className="flex flex-col items-center gap-4">
            <div className="font-display text-xl font-bold uppercase italic">
              Your nations are in! 🎉
            </div>
            <BulkResultChips results={bulkResults} />
            <button
              onClick={() => router.refresh()}
              className="rounded-full bg-primary px-8 py-3 font-display font-bold uppercase tracking-wider text-on-primary"
            >
              Finish
            </button>
          </div>
        )}
        {phase === "revealed" && !bulkMode && result && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="gold-glow flex items-center gap-3 rounded-full border border-secondary-fixed/40 bg-secondary-fixed/10 px-5 py-2.5">
              <img
                src={flagUrl(result.code, "w320")}
                alt={result.name}
                className="h-8 w-auto rounded shadow"
              />
              <span className="font-display text-lg font-bold uppercase">
                You drew {result.name}!
              </span>
              <span className="text-xs text-on-surface-variant">
                Group {result.wc_group}
                {winChanceLabel(result.name) && (
                  <>
                    {" · "}roughly{" "}
                    <span className="font-bold text-secondary-fixed">
                      {winChanceLabel(result.name)}
                    </span>{" "}
                    chance of winning, based on odds
                  </>
                )}
              </span>
            </div>
            <button
              onClick={() => router.refresh()}
              className="rounded-full bg-primary px-6 py-2.5 font-display font-bold uppercase tracking-wider text-on-primary"
            >
              {spinsLeft - 1 > 0 ? "Next spin" : "Finish"}
            </button>
          </div>
        )}
        {noSpins && phase !== "revealed" && (
          <p className="text-sm text-on-surface-variant">No spins remaining.</p>
        )}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-error">{error}</p>
      )}
    </div>
  );
}

function BulkResultChips({ results }: { results: SpinResult[] }) {
  return (
    <div className="flex max-w-2xl flex-wrap items-center justify-center gap-2">
      {results.map((t) => (
        <span
          key={t.id}
          className="flex items-center gap-2 rounded-full border border-secondary-fixed/40 bg-secondary-fixed/10 px-3 py-1.5 text-sm font-semibold"
        >
          <img
            src={flagUrl(t.code, "w160")}
            alt={t.name}
            className="h-4 w-auto rounded-sm"
          />
          {t.name}
          <span className="text-[10px] text-on-surface-variant">
            {t.wc_group}
            {winChanceLabel(t.name) ? ` · ${winChanceLabel(t.name)}` : ""}
          </span>
        </span>
      ))}
    </div>
  );
}
