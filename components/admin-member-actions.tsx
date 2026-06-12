"use client";

import { useRef } from "react";
import { kickMember, autoDraftMember } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

// Owner-only: remove a member from an open pool. Prompts for an optional
// message that's emailed to them with the removal notice.
export function KickMemberButton({
  poolId,
  userId,
  userName,
}: {
  poolId: string;
  userId: string;
  userName: string;
}) {
  const reasonRef = useRef<HTMLInputElement>(null);
  return (
    <form
      action={kickMember}
      className="inline-flex"
      onSubmit={(e) => {
        const reason = window.prompt(
          `Remove ${userName} from this pool?\n\nOptional message to include in the email they'll receive (leave blank to skip):`,
          "",
        );
        if (reason === null) {
          e.preventDefault();
          return;
        }
        if (reasonRef.current) reasonRef.current.value = reason;
      }}
    >
      <input type="hidden" name="poolId" value={poolId} />
      <input type="hidden" name="userId" value={userId} />
      <input ref={reasonRef} type="hidden" name="reason" defaultValue="" />
      <SubmitButton
        pendingLabel="…"
        className="ml-1 rounded-full px-1.5 text-xs text-on-surface-variant transition-colors hover:text-error disabled:opacity-50"
      >
        <span title={`Remove ${userName} from the pool`}>✕</span>
      </SubmitButton>
    </form>
  );
}

// Owner-only: instantly draft all of a slow member's remaining teams.
export function AutoDraftButton({
  poolId,
  userId,
  userName,
  remaining,
}: {
  poolId: string;
  userId: string;
  userName: string;
  remaining: number;
}) {
  return (
    <form
      action={autoDraftMember}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Auto-draft ${userName}?\n\nThis instantly assigns their remaining ${remaining} team${remaining === 1 ? "" : "s"} at random — no spins, no take-backs.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="poolId" value={poolId} />
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton
        pendingLabel="Drafting…"
        className="rounded-full border border-secondary-fixed/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary-fixed transition-colors hover:bg-secondary-fixed/10 disabled:opacity-50"
      >
        ⚡ Auto-draft
      </SubmitButton>
    </form>
  );
}
