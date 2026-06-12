export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center text-on-surface-variant">
      <div className="animate-spin-slow inline-block text-3xl">⚽️</div>
      <p className="mt-3 text-xs font-bold uppercase tracking-widest">
        Loading…
      </p>
    </div>
  );
}
