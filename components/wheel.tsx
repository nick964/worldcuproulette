"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { spinForTeam, type SpinResult } from "@/lib/actions";
import { flagUrl } from "@/lib/flags";

type Team = { id: string; name: string; code: string; wc_group: string };

const ITEM_W = 120; // px, must match the rendered item width
const SPIN_VELOCITY = 30; // px per frame while free-spinning (~1800 px/s @60fps)
const SPIN_PPS = SPIN_VELOCITY * 60; // px per second
const MIN_DECEL_DIST = 2200; // px the reel still travels after STOP, before landing

type Phase = "idle" | "spinning" | "stopping" | "revealed";

type Decel = {
  from: number;
  dist: number;
  durMs: number;
  start: number;
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

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const len = teams.length;
  const loopW = len * ITEM_W;
  // Enough copies so the reel always covers the window plus the full travel
  // distance (current offset + MIN_DECEL_DIST + up to one extra loop to align).
  const repeats = useMemo(() => {
    const needPx = MIN_DECEL_DIST + 3 * loopW + 1200;
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

  // Single continuous animation loop. While `decelRef` is null it free-spins at
  // constant velocity (including the brief window where we're awaiting the
  // server after STOP); once a target is set it eases out from the *current*
  // speed onto the team, with zero velocity discontinuity.
  const step = (now: number) => {
    const decel = decelRef.current;
    if (decel) {
      const p = Math.min(1, (now - decel.start) / decel.durMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      offsetRef.current = decel.from + decel.dist * eased;
      apply();
      if (p >= 1) {
        decelRef.current = null;
        setResult(decel.team);
        setPhaseBoth("revealed");
        return; // stop the loop
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
    decelRef.current = null;
    setPhaseBoth("spinning");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  const stop = async () => {
    if (phaseRef.current !== "spinning") return;
    // Keep the reel spinning (the loop is still running) while we ask the
    // server which team to land on — no hard stop.
    setPhaseBoth("stopping");

    let team: SpinResult;
    try {
      team = await spinForTeam(poolId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spin failed. Try again.");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPhaseBoth("idle");
      return;
    }

    // Compute a landing offset for the team that is at least MIN_DECEL_DIST
    // ahead of where the reel is right now, aligned to a copy of that team.
    const window = containerRef.current?.clientWidth ?? 600;
    const idx = Math.max(
      0,
      teams.findIndex((t) => t.id === team.id),
    );
    const idxOffset = idx * ITEM_W + ITEM_W / 2 - window / 2;
    const current = offsetRef.current;
    const k = Math.ceil((current + MIN_DECEL_DIST - idxOffset) / loopW);
    const target = idxOffset + k * loopW;
    const dist = Math.max(target - current, MIN_DECEL_DIST);

    // Duration chosen so easeOutCubic's initial velocity (3*dist/dur) equals the
    // current free-spin velocity — the slowdown begins seamlessly.
    const durMs = (3 * dist) / SPIN_PPS * 1000;

    decelRef.current = { from: current, dist, durMs, start: performance.now(), team };
    // The loop is already running; it will pick up decelRef on the next frame.
  };

  const noSpins = spinsLeft <= 0;

  return (
    <div>
      {/* Reel window */}
      <div
        ref={containerRef}
        className="relative h-32 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {/* center marker */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 -ml-px w-0.5 bg-emerald-500" />
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 z-10 -translate-x-1/2"
          style={{ width: ITEM_W }}
        >
          <div className="h-full rounded-lg ring-2 ring-emerald-500/60" />
        </div>

        <div ref={stripRef} className="flex h-full items-center will-change-transform">
          {reel.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              className="flex shrink-0 flex-col items-center justify-center gap-1 px-2"
              style={{ width: ITEM_W }}
            >
              <img
                src={flagUrl(t.code, "w160")}
                alt={t.name}
                className="h-12 w-auto rounded shadow-sm"
                draggable={false}
              />
              <span className="max-w-full truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center gap-3">
        {phase === "idle" && !noSpins && (
          <button
            onClick={startSpin}
            className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white"
          >
            Spin
          </button>
        )}
        {phase === "spinning" && (
          <button
            onClick={stop}
            className="animate-pulse rounded-full bg-red-600 px-8 py-3 font-bold text-white"
          >
            STOP
          </button>
        )}
        {phase === "stopping" && (
          <button
            disabled
            className="rounded-full bg-zinc-400 px-6 py-3 font-semibold text-white"
          >
            Landing…
          </button>
        )}
        {phase === "revealed" && result && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 dark:border-emerald-700 dark:bg-emerald-950/30">
              <img
                src={flagUrl(result.code, "w160")}
                alt={result.name}
                className="h-6 w-auto rounded-sm"
              />
              <span className="font-semibold">You drew {result.name}!</span>
              <span className="text-xs text-zinc-500">
                Group {result.wc_group}
              </span>
            </div>
            <button
              onClick={() => router.refresh()}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              {spinsLeft - 1 > 0 ? "Next spin" : "Finish"}
            </button>
          </div>
        )}
        {noSpins && phase !== "revealed" && (
          <p className="text-sm text-zinc-500">No spins remaining.</p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
