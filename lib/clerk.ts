import { clerkClient } from "@clerk/nextjs/server";

export type DisplayUser = { id: string; name: string; imageUrl: string };

// Resolve Clerk user ids to display names/avatars for rendering member lists,
// so we don't need a mirrored profiles table.
export async function getUserMap(
  userIds: string[],
): Promise<Map<string, DisplayUser>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, DisplayUser>();
  if (ids.length === 0) return map;

  const client = await clerkClient();
  const { data } = await client.users.getUserList({
    userId: ids,
    limit: ids.length,
  });

  for (const u of data) {
    const name =
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.username ||
      u.emailAddresses[0]?.emailAddress ||
      "Member";
    map.set(u.id, { id: u.id, name, imageUrl: u.imageUrl });
  }
  return map;
}

export function displayName(
  map: Map<string, DisplayUser>,
  userId: string,
): string {
  return map.get(userId)?.name ?? "Member";
}
