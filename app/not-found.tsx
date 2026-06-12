import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="text-5xl">🧭</div>
      <h1 className="mt-4 font-display text-2xl font-bold uppercase italic">
        Not found
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90"
      >
        Back home
      </Link>
    </div>
  );
}
