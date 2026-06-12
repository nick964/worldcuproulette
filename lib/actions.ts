"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getUserEmails } from "@/lib/clerk";
import { sendPoolLockedEmails, sendMemberKickedEmail } from "@/lib/email";
import { containsProfanity } from "@/lib/profanity";

async function requireUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

// Short, URL-safe, reasonably unique invite code.
function generateInviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");
}

export async function createPool(formData: FormData) {
  const userId = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Pool name is required.");
  // Free-text house rules (entry fee, payout, …); optional.
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  if (containsProfanity(name) || containsProfanity(notes)) {
    throw new Error(
      "Pool names and notes have to stay family-friendly — try different wording.",
    );
  }
  // Soft player target ("4 of 10 spots taken") — display-only, not enforced.
  const targetRaw = String(formData.get("target_size") ?? "").trim();
  let target_size: number | null = null;
  if (targetRaw) {
    const n = parseInt(targetRaw, 10);
    if (Number.isFinite(n)) target_size = Math.min(48, Math.max(1, n));
  }

  const supabase = createClient();
  const invite_code = generateInviteCode();

  const { data: pool, error } = await supabase
    .from("pools")
    .insert({
      name,
      owner_id: userId,
      invite_code,
      notes: notes || null,
      target_size,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Creator joins their own pool as owner.
  const { error: memberErr } = await supabase
    .from("pool_members")
    .insert({ pool_id: pool.id, user_id: userId, role: "owner" });
  if (memberErr) throw new Error(memberErr.message);

  revalidatePath("/pools");
  redirect(`/pools/${pool.id}`);
}

// Set the user's display name in Clerk (first word → firstName, rest →
// lastName). For email sign-ups that never collected a name, so member lists
// don't fall back to raw email addresses.
export async function updateDisplayName(formData: FormData) {
  const userId = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) throw new Error("Display name is required.");
  if (containsProfanity(name)) {
    throw new Error(
      "That name won't fly here — keep it family-friendly and try again.",
    );
  }

  const [firstName, ...rest] = name.split(/\s+/);
  const client = await clerkClient();
  await client.users.updateUser(userId, {
    firstName,
    lastName: rest.join(" "),
  });

  revalidatePath("/pools");
}

export async function joinPoolByCode(formData: FormData) {
  await requireUser();
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  if (!code) throw new Error("Invite code is required.");

  const supabase = createClient();
  const { data: poolId, error } = await supabase.rpc("join_pool", {
    p_code: code,
  });
  if (error) throw new Error(error.message);
  if (!poolId) throw new Error("That invite code is not valid.");

  revalidatePath("/pools");
  redirect(`/pools/${poolId}`);
}

// Used by the /join/[code] page button (bound to the code).
export async function joinPool(code: string) {
  await requireUser();
  const supabase = createClient();
  const { data: poolId, error } = await supabase.rpc("join_pool", {
    p_code: code,
  });
  if (error) throw new Error(error.message);
  if (!poolId) throw new Error("That invite code is not valid.");
  redirect(`/pools/${poolId}`);
}

export async function leavePool(formData: FormData) {
  await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  if (!poolId) throw new Error("Missing pool.");

  // RPC rather than a direct delete: it also releases any early pick back
  // into the pot, atomically.
  const supabase = createClient();
  const { error } = await supabase.rpc("leave_pool", { p_pool_id: poolId });
  if (error) throw new Error(error.message);

  revalidatePath(`/pools/${poolId}`);
}

// Owner-only, destructive: removes the pool and (via cascade) its members
// and picks. RLS's pools_delete policy is the real gate; the owner_id filter
// here just makes the "not yours" case explicit.
export async function deletePool(formData: FormData) {
  const userId = await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  if (!poolId) throw new Error("Missing pool.");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("pools")
    .delete()
    .eq("id", poolId)
    .eq("owner_id", userId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error("Only the pool owner can delete this pool.");
  }

  revalidatePath("/pools");
  redirect("/pools");
}

// Owner removes a member from an open pool; they get an email with the
// owner's (optional) reason. Email problems never block the removal.
export async function kickMember(formData: FormData) {
  await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!poolId || !userId) throw new Error("Missing pool or member.");

  const supabase = createClient();
  const { error } = await supabase.rpc("kick_member", {
    p_pool_id: poolId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);

  try {
    const [{ data: pool }, emailMap] = await Promise.all([
      supabase.from("pools").select("name").eq("id", poolId).single(),
      getUserEmails([userId]),
    ]);
    const u = emailMap.get(userId);
    if (pool && u?.email) {
      await sendMemberKickedEmail({
        email: u.email,
        name: u.name,
        poolName: pool.name,
        reason,
      });
    }
  } catch (e) {
    console.error("[email] kicked notification failed:", e);
  }

  revalidatePath(`/pools/${poolId}`);
}

// Owner fills all of a slow member's remaining picks at random (one atomic
// RPC). For drafts dragging on because someone won't spin.
export async function autoDraftMember(formData: FormData) {
  await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!poolId || !userId) throw new Error("Missing pool or member.");

  const supabase = createClient();
  const { error } = await supabase.rpc("auto_draft_member", {
    p_pool_id: poolId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/pools/${poolId}`);
}

export async function lockPool(formData: FormData) {
  await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  if (!poolId) throw new Error("Missing pool.");

  const supabase = createClient();
  const { error } = await supabase.rpc("lock_pool", { p_pool_id: poolId });
  if (error) throw new Error(error.message);

  // The draft is open — email every member their REMAINING spin count
  // (early first spins already count against the allotment). Email problems
  // are logged but never block the lock.
  try {
    const [{ data: pool }, { data: members }, { data: picks }] =
      await Promise.all([
        supabase.from("pools").select("name").eq("id", poolId).single(),
        supabase
          .from("pool_members")
          .select("user_id, teams_allotted")
          .eq("pool_id", poolId),
        supabase.from("picks").select("user_id").eq("pool_id", poolId),
      ]);
    if (pool && members?.length) {
      const usedByUser = new Map<string, number>();
      for (const p of picks ?? []) {
        usedByUser.set(p.user_id, (usedByUser.get(p.user_id) ?? 0) + 1);
      }
      const emailMap = await getUserEmails(members.map((m) => m.user_id));
      const origin =
        (await headers()).get("origin") ?? "https://worldcuproulette.com";
      await sendPoolLockedEmails({
        poolName: pool.name,
        poolUrl: `${origin}/pools/${poolId}`,
        members: members.flatMap((m) => {
          const u = emailMap.get(m.user_id);
          const remaining = Math.max(
            0,
            m.teams_allotted - (usedByUser.get(m.user_id) ?? 0),
          );
          return u?.email
            ? [{ email: u.email, name: u.name, spins: remaining }]
            : [];
        }),
      });
    }
  } catch (e) {
    console.error("[email] pool-locked notification failed:", e);
  }

  revalidatePath(`/pools/${poolId}`);
}

export type SpinResult = {
  id: string;
  name: string;
  code: string;
  wc_group: string;
};

// Server-authoritative spin: the team is chosen atomically here; the wheel only
// animates toward it. No revalidatePath — that would auto-refresh and wipe the
// wheel's reveal; the Wheel calls router.refresh() itself.
export async function spinForTeam(poolId: string): Promise<SpinResult> {
  await requireUser();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("assign_random_team", {
    p_pool_id: poolId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No team was assigned.");

  const team = data as SpinResult;
  return {
    id: team.id,
    name: team.name,
    code: team.code,
    wc_group: team.wc_group,
  };
}

export async function setWinningTeam(formData: FormData) {
  await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!poolId || !teamId) throw new Error("Missing pool or team.");

  const supabase = createClient();
  const { error } = await supabase.rpc("set_winning_team", {
    p_pool_id: poolId,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/pools/${poolId}`);
}
