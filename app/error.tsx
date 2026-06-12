"use client";

// Global error boundary. Server actions (join, lock, spin, etc.) throw on
// failure; this renders the message instead of a crash.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="text-5xl">😬</div>
      <h1 className="mt-4 font-display text-2xl font-bold uppercase italic">
        Off the post!
      </h1>
      <p className="mt-2 break-words text-sm text-on-surface-variant">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
