import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Server-side Supabase client. Authenticates requests as the signed-in Clerk
// user by passing Clerk's session token to Supabase (native third-party auth).
// Use from Server Components, Route Handlers, and Server Actions.
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return (await auth()).getToken();
    },
  });
}
