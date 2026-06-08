"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { spinForTeam, type SpinResult } from "@/lib/actions";
import { flagUrl } from "@/lib/flags";

type Team = { id: string; name: string; code: string; wc_group: string };

const SPIN_VELOCITY = 32; // px per frame while free-spinning (~1920 px/s @60fps)
const SPIN_PPS = SPIN_VELOCITY * 60; // px per second
const MIN_DECEL_DIST = 2600; // px the reel still travels after STOP, before landing

type Phase = "idle" | "spinning" | "stopping" | "revealed";

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

  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { itemW, flagW, flagH, bandH } = size;
  const len = teams.length;
  const loopW = len * itemW;

  const repeats = useMemo(() => {
    const needPx = MIN_DECEL_DIST + 3 * loopW + 1600;
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
      const p = Math.min(1, (now - decel.start) / decel.durMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
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
    decelRef.current = null;
    setPhaseBoth("spinning");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  const stop = async () => {
    if (phaseRef.current !== "spinning") return;
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

    const window = containerRef.current?.clientWidth ?? 600;
    const idx = Math.max(
      0,
      teams.findIndex((t) => t.id === team.id),
    );
    const idxOffset = idx * itemW + itemW / 2 - window / 2;
    const current = offsetRef.current;
    const k = Math.ceil((current + MIN_DECEL_DIST - idxOffset) / loopW);
    const target = idxOffset + k * loopW;
    const dist = Math.max(target - current, MIN_DECEL_DIST);
    // duration sized so easeOutCubic's initial velocity matches the spin speed
    const durMs = ((3 * dist) / SPIN_PPS) * 1000;

    decelRef.current = { from: current, dist, durMs, start: performance.now(), team };
  };

  const noSpins = spinsLeft <= 0;

  return (
    <div>
      {/* Full-bleed reel band */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden border-y-2 border-emerald-500/40 bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950"
          style={{ height: bandH }}
        >
          {/* edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-zinc-100 to-transparent dark:from-zinc-950" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-zinc-100 to-transparent dark:from-zinc-950" />

          {/* center marker */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -ml-px w-0.5 bg-emerald-500" />
          <div
            className="pointer-events-none absolute inset-y-2 left-1/2 z-20 -translate-x-1/2 rounded-2xl ring-4 ring-emerald-500/70"
            style={{ width: itemW }}
          />

          <div
            ref={stripRef}
            className="flex h-full items-center will-change-transform"
          >
            {reel.map((t, i) => (
              <div
                key={`${t.id}-${i}`}
                className="flex shrink-0 flex-col items-center justify-center gap-2"
                style={{ width: itemW }}
              >
                <img
                  src={flagUrl(t.code, "w640")}
                  alt={t.name}
                  className="rounded-xl object-cover shadow-xl"
                  style={{ width: flagW, height: flagH }}
                  draggable={false}
                />
                <span
                  className="max-w-full truncate font-semibold text-zinc-700 dark:text-zinc-300"
                  style={{ width: flagW }}
                >
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex min-h-14 items-center justify-center gap-3">
        {phase === "idle" && !noSpins && (
          <button
            onClick={startSpin}
            className="rounded-full bg-emerald-600 px-10 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-emerald-700"
          >
            Spin 🎡
          </button>
        )}
        {phase === "spinning" && (
          <button
            onClick={stop}
            className="animate-pulse rounded-full bg-red-600 px-14 py-4 text-xl font-extrabold tracking-wide text-white shadow-lg"
          >
            STOP
          </button>
        )}
        {phase === "stopping" && (
          <button
            disabled
            className="rounded-full bg-zinc-400 px-10 py-4 text-lg font-bold text-white"
          >
            Landing…
          </button>
        )}
        {phase === "revealed" && result && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2.5 dark:border-emerald-700 dark:bg-emerald-950/30">
              <img
                src={flagUrl(result.code, "w320")}
                alt={result.name}
                className="h-8 w-auto rounded shadow"
              />
              <span className="text-lg font-bold">You drew {result.name}!</span>
              <span className="text-xs text-zinc-500">
                Group {result.wc_group}
              </span>
            </div>
            <button
              onClick={() => router.refresh()}
              className="rounded-full bg-zinc-900 px-6 py-2.5 font-semibold text-white dark:bg-white dark:text-zinc-900"
            >
              {spinsLeft - 1 > 0 ? "Next spin" : "Finish"}
            </button>
          </div>
        )}
        {noSpins && phase !== "revealed" && (
          <p className="text-sm text-zinc-500">No spins remaining.</p>
        )}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
