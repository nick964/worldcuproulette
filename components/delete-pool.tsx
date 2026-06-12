"use client";

import { deletePool } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

// Owner-only delete with a native confirm gate — the action is irreversible.
export function DeletePoolButton({
  poolId,
  poolName,
}: {
  poolId: string;
  poolName: string;
}) {
  return (
    <form
      action={deletePool}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${poolName}"?\n\nThis permanently removes the pool, its invite link, all members, and every drafted team. There is no undo.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="poolId" value={poolId} />
      <SubmitButton
        pendingLabel="Deleting…"
        className="rounded-lg border border-error/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-error transition-colors hover:bg-error-container/30 disabled:opacity-50"
      >
        Delete pool
      </SubmitButton>
    </form>
  );
}
