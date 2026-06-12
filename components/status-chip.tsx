const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  locked: {
    label: "Drafting",
    className:
      "border-secondary-fixed/30 bg-secondary-fixed/10 text-secondary-fixed",
  },
  complete: {
    label: "Complete",
    className: "border-white/10 bg-surface-variant text-on-surface-variant",
  },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? {
    label: status,
    className: "border-white/10 bg-surface-variant text-on-surface-variant",
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${s.className}`}
    >
      {s.label}
    </span>
  );
}
