"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { spinForTeam, type SpinResult } from "@/lib/actions";
import { flagUrl } from "@/lib/flags";

type Team = { id: string; name: string; code: string; wc_group: string };

const ITEM_W = 120; // px, must match the rendered item width
const EXTRA_LOOPS = 5; // full passes before landing, for drama
const SPIN_VELOCITY = 30; // px per frame while free-spinning
const DECEL_MS = 3500; // deceleration duration

type Phase = "idle" | "spinning" | "stopping" | "revealed";

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

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const len = teams.length;
  // Enough copies of the team list so the reel always covers the window plus the
  // full deceleration distance (which lands within EXTRA_LOOPS+1 passes).
  const repeats = Math.max(8, EXTRA_LOOPS + 3 + Math.ceil(25 / Math.max(len, 1)));
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

  // The parent remounts this component (via a key on teams/spinsLeft) after a
  // pick commits, so state resets naturally — no reset effect needed here.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const freeSpin = () => {
    const loopW = len * ITEM_W;
    const frame = () => {
      offsetRef.current += SPIN_VELOCITY;
      if (offsetRef.current >= loopW) offsetRef.current -= loopW;
      apply();
      if (phaseRef.current === "spinning") {
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const startSpin = () => {
    if (len === 0 || spinsLeft <= 0) return;
    setError(null);
    setResult(null);
    setPhaseBoth("spinning");
    freeSpin();
  };

  const stop = async () => {
    if (phaseRef.current !== "spinning") return;
    setPhaseBoth("stopping");
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    let team: SpinResult;
    try {
      team = await spinForTeam(poolId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spin failed. Try again.");
      setPhaseBoth("idle");
      return;
    }

    const window = containerRef.current?.clientWidth ?? 600;
    const idx = Math.max(
      0,
      teams.findIndex((t) => t.id === team.id),
    );
    const targetAbsIndex = EXTRA_LOOPS * len + idx;
    const targetOffset =
      targetAbsIndex * ITEM_W + ITEM_W / 2 - window / 2;

    const from = offsetRef.current;
    const dist = targetOffset - from;
    const startTime = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / DECEL_MS);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      offsetRef.current = from + dist * eased;
      apply();
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setResult(team);
        setPhaseBoth("revealed");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
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
              <span className="font-semibold">
                You drew {result.name}!
              </span>
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
