"use client";

import { useSession } from "@clerk/nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Browser-side Supabase client hook. Authenticates requests as the signed-in
// Clerk user by passing Clerk's session token to Supabase. Call inside a
// Client Component: `const supabase = useSupabaseClient();`
export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(
    () =>
      createSupabaseClient(supabaseUrl, supabaseKey, {
        async accessToken() {
          return session?.getToken() ?? null;
        },
      }),
    [session],
  );
}
