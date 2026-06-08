"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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

  const supabase = createClient();
  const invite_code = generateInviteCode();

  const { data: pool, error } = await supabase
    .from("pools")
    .insert({ name, owner_id: userId, invite_code })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Creator joins their own pool as owner.
  const { error: memberErr } = await supabase
    .from("pool_members")
    .insert({ pool_id: pool.id, user_id: userId, role: "owner" });
  if (memberErr) throw new Error(memberErr.message);

  revalidatePath("/");
  redirect(`/pools/${pool.id}`);
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

  revalidatePath("/");
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
  const userId = await requireUser();
  const poolId = String(formData.get("poolId") ?? "");
  if (!poolId) throw new Error("Missing pool.");

  const supabase = createClient();
  const { error } = await supabase
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", userId);
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
