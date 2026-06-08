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
      <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 break-words text-sm text-zinc-600 dark:text-zinc-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
      >
        Try again
      </button>
    </div>
  );
}
