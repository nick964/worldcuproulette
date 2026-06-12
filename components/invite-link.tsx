"use client";

import { useState } from "react";

// Builds the absolute join URL on the client and offers one-click copy.
export function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${code}`
      : `/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; the input is still selectable
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 truncate rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface-variant outline-none transition-colors focus:border-primary"
      />
      <button
        onClick={copy}
        className={`shrink-0 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
          copied
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-primary text-on-primary hover:opacity-90"
        }`}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
